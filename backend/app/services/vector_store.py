import os
import pickle
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

from app.core.config import settings
from app.core.logging import logger
from app.services.audio_processor import format_timestamp
from app.schemas.chat import Citation
from app.services.llm_service import OllamaClient

_EMBEDDER_INSTANCE = None

class SimpleFallbackEmbedder:
    """Fast deterministic local fallback embedder for offline / test environments."""
    def __init__(self, dim: int = 384):
        self.dim = dim

    def encode(self, texts: List[str], convert_to_numpy: bool = True, normalize_embeddings: bool = True) -> np.ndarray:
        vectors = []
        for text in texts:
            vec = np.zeros(self.dim, dtype=np.float32)
            words = text.lower().split()
            for word in words:
                h = abs(hash(word)) % self.dim
                vec[h] += 1.0
            norm = np.linalg.norm(vec)
            if norm > 0 and normalize_embeddings:
                vec = vec / norm
            vectors.append(vec)
        return np.array(vectors, dtype=np.float32)

def get_embedder():
    """Load local sentence-transformers embedding model with robust offline fallback."""
    global _EMBEDDER_INSTANCE
    if _EMBEDDER_INSTANCE is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading sentence-transformers model '{settings.EMBEDDING_MODEL}' on {settings.EMBEDDING_DEVICE}...")
            try:
                # Fast offline load first
                _EMBEDDER_INSTANCE = SentenceTransformer(
                    settings.EMBEDDING_MODEL,
                    device=settings.EMBEDDING_DEVICE,
                    local_files_only=True
                )
            except Exception:
                _EMBEDDER_INSTANCE = SentenceTransformer(
                    settings.EMBEDDING_MODEL,
                    device=settings.EMBEDDING_DEVICE
                )
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer ({e}). Using deterministic local embedding fallback.")
            _EMBEDDER_INSTANCE = SimpleFallbackEmbedder(384)
    return _EMBEDDER_INSTANCE

class MeetingVectorStore:
    def __init__(self, meeting_id: int):
        self.meeting_id = meeting_id
        self.index_dir = settings.VECTOR_DIR / f"meeting_{meeting_id}"
        self.index_file = self.index_dir / "index.faiss"
        self.meta_file = self.index_dir / "metadata.pkl"
        self.index = None
        self.chunks_metadata: List[Dict[str, Any]] = []

    def build_index(self, chunks: List[Any]):
        """
        Build and save FAISS index for a meeting's transcript chunks.
        chunks: List of TranscriptChunk or dicts
        """
        import faiss

        if not chunks:
            logger.warning(f"No chunks to index for meeting {self.meeting_id}")
            return

        embedder = get_embedder()
        texts = []
        meta_list = []

        for chk in chunks:
            chk_dict = chk.to_dict() if hasattr(chk, "to_dict") else dict(chk)
            texts.append(chk_dict["formatted_text"])
            meta_list.append(chk_dict)

        logger.info(f"Embedding {len(texts)} chunks for meeting {self.meeting_id}...")
        embeddings = embedder.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        embeddings = np.ascontiguousarray(embeddings, dtype=np.float32)

        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(embeddings)

        os.makedirs(self.index_dir, exist_ok=True)
        faiss.write_index(index, str(self.index_file))

        with open(self.meta_file, "wb") as f:
            pickle.dump(meta_list, f)

        self.index = index
        self.chunks_metadata = meta_list
        logger.info(f"Vector index saved for meeting {self.meeting_id} ({len(meta_list)} chunks).")

    def load_index(self) -> bool:
        """Load index and metadata from disk."""
        import faiss

        if not self.index_file.exists() or not self.meta_file.exists():
            # Attempt to auto-rebuild index on-the-fly from transcript segments if available
            try:
                from app.core.database import SessionLocal
                from app.models.db_models import TranscriptSegment
                from app.services.chunker import chunk_transcript
                db = SessionLocal()
                segs = db.query(TranscriptSegment).filter(TranscriptSegment.meeting_id == self.meeting_id).order_by(TranscriptSegment.start_time).all()
                db.close()
                if segs:
                    seg_dicts = [
                        {"id": s.id, "start": s.start_time, "end": s.end_time, "speaker_label": s.speaker_label, "cleaned_text": s.cleaned_text}
                        for s in segs
                    ]
                    chunks = chunk_transcript(seg_dicts, target_words_per_chunk=350, overlap_words=40)
                    if chunks:
                        self.build_index(chunks)
            except Exception as rebuild_err:
                logger.warning(f"Could not automatically rebuild index for meeting {self.meeting_id}: {rebuild_err}")

        if not self.index_file.exists() or not self.meta_file.exists():
            return False

        try:
            self.index = faiss.read_index(str(self.index_file))
            with open(self.meta_file, "rb") as f:
                self.chunks_metadata = pickle.load(f)
            return True
        except Exception as e:
            logger.error(f"Failed to load vector index for meeting {self.meeting_id}: {e}")
            return False

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Search top-k most relevant chunks for the query."""
        if self.index is None:
            if not self.load_index():
                logger.warning(f"No index found for meeting {self.meeting_id}")
                return []

        embedder = get_embedder()
        query_vec = embedder.encode([query], convert_to_numpy=True, normalize_embeddings=True)
        query_vec = np.ascontiguousarray(query_vec, dtype=np.float32)

        k = min(top_k, self.index.ntotal)
        if k == 0:
            return []

        scores, indices = self.index.search(query_vec, k)
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1 and idx < len(self.chunks_metadata):
                item = dict(self.chunks_metadata[idx])
                item["similarity_score"] = float(scores[0][i])
                results.append(item)

        return results

    async def answer_question(self, query: str, meeting_title: str) -> Tuple[str, List[Citation]]:
        """
        Retrieve chunks and prompt Ollama to generate an evidence-backed answer with citations.
        """
        top_chunks = self.search(query, top_k=3)

        if not top_chunks:
            return "This information was not found in the meeting recording.", []

        # Build context from top chunks
        context_blocks = []
        for chk in top_chunks:
            start_ts = format_timestamp(chk["start_time"])
            end_ts = format_timestamp(chk["end_time"])
            ts_str = f"{start_ts} - {end_ts}"
            context_blocks.append(f"[Time: {ts_str}]\n{chk['formatted_text']}")

        rag_prompt = f"""
You are the Meeting Intelligence AI assistant. Answer the user's question accurately using ONLY the provided meeting excerpts.

Rules:
1. Base your answer strictly on the transcript excerpts below.
2. If the answer is not mentioned in or cannot be deduced from the excerpts, respond exactly: "This information was not found in the meeting recording."
3. Cite the relevant timestamps in your response using format [HH:MM:SS].
4. Keep the answer clear, helpful, and concise.

MEETING TITLE: {meeting_title}

RELEVANT MEETING EXCERPTS:
{chr(10).join(context_blocks)}

USER QUESTION:
{query}

ANSWER:
"""
        ollama = OllamaClient()
        model = await ollama.resolve_model()
        if not model:
            raise RuntimeError(
                "No local LLM model found in Ollama. Please ensure Ollama is running and has a model pulled (e.g. qwen2.5:7b, llama3.2:3b)."
            )
        
        try:
            import httpx
            payload = {
                "model": model,
                "prompt": rag_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 1024
                }
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(f"{ollama.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    answer = res.json().get("response", "").strip()
                    abstention_phrases = [
                        "not found in the meeting recording",
                        "not found in this meeting",
                        "not found in the recording",
                        "not mentioned in the meeting",
                        "not mentioned in the excerpts",
                        "not mentioned in this recording",
                        "not mentioned anywhere",
                        "not addressed in the meeting",
                        "does not mention",
                        "no mention of",
                        "cannot find any mention",
                        "not provided in the transcript",
                        "not discussed in the meeting",
                        "not discussed during the meeting"
                    ]
                    if any(phrase in answer.lower() for phrase in abstention_phrases):
                        return "This information was not found in the meeting recording.", []

                    citations = self._extract_fine_grained_citations(query, answer, top_chunks)
                    return answer, citations
                else:
                    raise RuntimeError(f"Ollama returned HTTP status {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Error calling Ollama for Q&A: {e}")
            raise RuntimeError(f"Local AI service (Ollama) is temporarily unavailable: {str(e)}")

    def _extract_fine_grained_citations(
        self,
        query: str,
        answer: str,
        top_chunks: List[Dict[str, Any]]
    ) -> List[Citation]:
        """
        Extract the smallest relevant transcript spans with correct timestamps and speaker labels.
        Never returns broad multi-minute chunks.
        Scoped strictly to the selected meeting.
        """
        from app.core.database import SessionLocal
        from app.models.db_models import TranscriptSegment
        from app.services.grounding_verifier import extract_content_words
        import re

        # Collect segment IDs from candidate chunks
        candidate_seg_ids = set()
        for chk in top_chunks:
            if chk.get("segment_ids"):
                candidate_seg_ids.update(chk["segment_ids"])

        db = SessionLocal()
        try:
            query_db = db.query(TranscriptSegment).filter(TranscriptSegment.meeting_id == self.meeting_id)
            if candidate_seg_ids:
                query_db = query_db.filter(TranscriptSegment.id.in_(candidate_seg_ids))
            segments = query_db.all()
        except Exception as e:
            logger.error(f"Error fetching segments for citations: {e}")
            segments = []
        finally:
            db.close()

        if not segments:
            return []

        # Parse timestamps mentioned in the answer (e.g. [00:00:21] or 00:00:21)
        timestamp_matches = re.findall(r"\b(?:\[)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\])?\b", answer)
        cited_seconds = []
        for m in timestamp_matches:
            if m[2]:  # HH:MM:SS
                secs = int(m[0]) * 3600 + int(m[1]) * 60 + int(m[2])
            else:  # MM:SS
                secs = int(m[0]) * 60 + int(m[1])
            cited_seconds.append(secs)

        query_words = extract_content_words(query)
        answer_words = extract_content_words(answer)

        scored_segments = []
        for seg in segments:
            seg_text = seg.cleaned_text or seg.raw_text or ""
            seg_words = extract_content_words(seg_text)
            if not seg_words:
                continue

            score = 0.0
            # Strong boost if segment spans a timestamp explicitly cited in answer
            for sec in cited_seconds:
                if (seg.start_time - 1.5) <= sec <= (seg.end_time + 1.5):
                    score += 15.0

            # Semantic overlap with answer content
            ans_common = len(seg_words.intersection(answer_words))
            score += ans_common * 2.0

            # Semantic overlap with query content
            q_common = len(seg_words.intersection(query_words))
            score += q_common * 1.0

            if score > 1.5:
                scored_segments.append((score, seg))

        if not scored_segments:
            return []

        # Sort by score descending and take the 1-2 most relevant segments
        scored_segments.sort(key=lambda x: x[0], reverse=True)
        selected = [s[1] for s in scored_segments[:2]]
        selected.sort(key=lambda s: s.start_time)

        citations = []
        for seg in selected:
            start_ts = format_timestamp(seg.start_time)
            end_ts = format_timestamp(seg.end_time)
            citations.append(Citation(
                segment_id=seg.id,
                start_time=seg.start_time,
                end_time=seg.end_time,
                timestamp_str=f"{start_ts} - {end_ts}",
                speaker_label=seg.speaker_label or "Speaker",
                text=seg.cleaned_text or seg.raw_text or ""
            ))

        return citations

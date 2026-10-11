import json
import re
import datetime
from typing import List, Dict, Any, Optional, Tuple
import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.core.logging import logger
from app.schemas.analysis import (
    MeetingAnalysis, ChunkAnalysis, KeyPointExtraction, DecisionExtraction,
    ActionItemExtraction, ImportantDateExtraction, ScheduledEventExtraction,
    TakeawayExtraction, UnresolvedQuestionExtraction, SentimentReport, SpeakerSentimentMetric
)
from app.services.chunker import TranscriptChunk

import time

class OllamaClient:
    _cached_models: List[str] = []
    _cached_time: float = 0.0

    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.preferred_model = model or settings.OLLAMA_MODEL
        self._resolved_model: Optional[str] = None

    async def get_available_models(self) -> List[str]:
        """Fetch list of models currently pulled in local Ollama with TTL cache."""
        now = time.time()
        if now - OllamaClient._cached_time < 10.0:
            return OllamaClient._cached_models

        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    OllamaClient._cached_models = [m for m in models if m]
                    OllamaClient._cached_time = now
                    return OllamaClient._cached_models
        except Exception as e:
            logger.warning(f"Could not connect to Ollama at {self.base_url}: {e}")

        OllamaClient._cached_models = []
        OllamaClient._cached_time = now
        return []

    async def resolve_model(self) -> Optional[str]:
        """Find the best available model in local Ollama or None if none pulled."""
        if self._resolved_model:
            return self._resolved_model

        available = await self.get_available_models()
        if not available:
            logger.warning(f"No Ollama models currently available at {self.base_url}.")
            return None

        # 1. Exact match
        for m in available:
            if m == self.preferred_model or m.startswith(f"{self.preferred_model}:") or self.preferred_model in m:
                self._resolved_model = m
                return m

        # 2. Preferred fallbacks
        fallbacks = [fb.strip() for fb in settings.OLLAMA_FALLBACK_MODELS.split(",") if fb.strip()]
        for fb in fallbacks:
            for m in available:
                if fb in m or m.startswith(fb):
                    logger.info(f"Ollama model '{self.preferred_model}' not found; using fallback '{m}'")
                    self._resolved_model = m
                    return m

        # 3. First available
        self._resolved_model = available[0]
        logger.info(f"Using first available Ollama model: '{self._resolved_model}'")
        return self._resolved_model

    async def generate_json(self, prompt: str, schema_class: Any, max_retries: int = 2) -> Optional[Any]:
        """
        Call Ollama API with format='json' and validate against Pydantic schema.
        Retries on validation or JSON parsing failure.
        """
        model = await self.resolve_model()
        if not model:
            return None

        url = f"{self.base_url}/api/generate"
        system_prompt = (
            "You are an expert meeting analyst and executive secretary. "
            "Analyze the meeting transcript objectively and extract factual, structured information. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. Output ONLY valid JSON matching the requested schema.\n"
            "2. Never invent names, facts, dates, decisions, impacts, or action items not stated in the transcript.\n"
            "3. If an action item does not have an explicitly identifiable assignee, set assignee to 'Unassigned'.\n"
            "4. If an action item has no explicitly spoken deadline, set deadline to null. Never invent deadlines.\n"
            "5. If a decision has no explicitly discussed context or impact, set context and impact to null.\n"
            "6. If any date or deadline is ambiguous, set needs_confirmation to true.\n"
            "7. For evidence, cite the exact source text and segment IDs.\n"
            "8. Sentiment is strictly an estimated tone observation, not an evaluation of participant competence."
        )

        for attempt in range(1, max_retries + 1):
            try:
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "system": system_prompt,
                    "format": "json",
                    "stream": False,
                    "options": {
                        "temperature": settings.OLLAMA_TEMPERATURE,
                        "num_predict": 4096
                    }
                }

                async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
                    response = await client.post(url, json=payload)
                    
                if response.status_code != 200:
                    logger.error(f"Ollama error {response.status_code}: {response.text}")
                    continue

                raw_response = response.json().get("response", "").strip()
                
                # Clean possible markdown wrapping
                if raw_response.startswith("```json"):
                    raw_response = raw_response[7:]
                if raw_response.startswith("```"):
                    raw_response = raw_response[3:]
                if raw_response.endswith("```"):
                    raw_response = raw_response[:-3]
                raw_response = raw_response.strip()

                parsed_json = json.loads(raw_response)
                
                # Sanitize common small-model variations (e.g. lists of strings instead of dicts)
                if isinstance(parsed_json, dict):
                    for field, key_name in [
                        ("key_points", "point"),
                        ("takeaways", "takeaway"),
                        ("unresolved_questions", "question"),
                        ("decisions", "decision"),
                        ("action_items", "description")
                    ]:
                        if field in parsed_json and isinstance(parsed_json[field], list):
                            clean_items = []
                            for item in parsed_json[field]:
                                if isinstance(item, str) and item.strip():
                                    clean_items.append({key_name: item.strip()})
                                elif isinstance(item, dict):
                                    clean_items.append(item)
                            parsed_json[field] = clean_items

                    for field, req_key in [
                        ("important_dates", "raw_phrase"),
                        ("scheduled_events", "event_title")
                    ]:
                        if field in parsed_json and isinstance(parsed_json[field], list):
                            parsed_json[field] = [
                                it for it in parsed_json[field]
                                if isinstance(it, dict) and (it.get(req_key) or it.get("source_text"))
                            ]

                validated_data = schema_class.model_validate(parsed_json)
                return validated_data

            except (json.JSONDecodeError, ValidationError) as err:
                logger.warning(f"Ollama JSON validation failed on attempt {attempt}/{max_retries}: {err}")
                if attempt == max_retries:
                    logger.error(f"Final attempt failed for schema {schema_class.__name__}")
                    return None
            except Exception as e:
                logger.error(f"Ollama request error on attempt {attempt}: {e}")
                if attempt == max_retries:
                    return None

        return None


def heuristic_extract_chunk(chunk: TranscriptChunk, meeting_title: str, meeting_date_str: str) -> ChunkAnalysis:
    """
    Grounded linguistic pattern extractor that pulls action items, decisions,
    important dates, key points, takeaways, and questions strictly from transcript chunks.
    Never fabricates deadlines, impacts, or fictitious owners.
    """
    raw_text = chunk.formatted_text
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    
    key_points: List[KeyPointExtraction] = []
    decisions: List[DecisionExtraction] = []
    action_items: List[ActionItemExtraction] = []
    important_dates: List[ImportantDateExtraction] = []
    scheduled_events: List[ScheduledEventExtraction] = []
    takeaways: List[TakeawayExtraction] = []
    unresolved_questions: List[UnresolvedQuestionExtraction] = []

    action_patterns = [
        re.compile(r'(?:i will|i\'ll|i am going to|i\'m going to|we need to|let\'s make sure to|please|action item|will follow up|will create|will update|will send|will prepare|will check|will fix|working on|responsible for)\s+([^.?!;]+)', re.IGNORECASE),
        re.compile(r'(?:assign(?:ed)?\s+to|todo:?)\s+([^.?!;]+)', re.IGNORECASE),
    ]

    decision_patterns = [
        re.compile(r'(?:we decided|decided to|agreed to|agreed that|conclusion is|let\'s go with|going forward with|approved|we will stick with|chosen to|settled on|finalize)\s+([^.?!;]+)', re.IGNORECASE),
        re.compile(r'(?:the decision is|consensus is)\s+([^.?!;]+)', re.IGNORECASE),
    ]

    date_patterns = [
        re.compile(r'\b(?:by|on|before|due|scheduled for|deadline is)\s+((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|end of (?:the )?(?:week|month|quarter)|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december))?|\d{4}-\d{2}-\d{2}))', re.IGNORECASE),
    ]

    substantive_sentences = []

    for line in lines:
        speaker_name = "Unknown"
        speaker_match = re.match(r'^(?:\[[\d:]+\]\s*)?(.*?):\s*(.*)$', line)
        if speaker_match:
            speaker_name = speaker_match.group(1).strip()
            speech_body = speaker_match.group(2).strip()
        else:
            speech_body = re.sub(r'^\[[\d:]+\]\s*', '', line).strip()

        if len(speech_body) > 15:
            substantive_sentences.append(speech_body)

        # 1. Action Items (Strict Grounding)
        for pat in action_patterns:
            m = pat.search(speech_body)
            if m:
                act_text = m.group(0).strip()
                if len(act_text) > 10:
                    # Grounded assignee extraction: only if someone volunteered in 1st person or was explicitly assigned
                    first_person_match = re.search(r'\b(?:i will|i\'ll|i am going to|i\'m going to)\b', speech_body, re.IGNORECASE)
                    assigned_match = re.search(r'\bassign(?:ed)?\s+to\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b', speech_body, re.IGNORECASE)
                    
                    if assigned_match:
                        assignee = assigned_match.group(1).strip()
                    elif first_person_match and speaker_name not in ["Unknown", "Speaker", "Unknown Speaker", "Team Member"]:
                        assignee = speaker_name
                    else:
                        assignee = "Unassigned"

                    # Grounded deadline extraction: only if explicitly stated in this sentence
                    deadline = None
                    date_match = date_patterns[0].search(speech_body)
                    if date_match:
                        deadline = date_match.group(0).strip()

                    action_items.append(ActionItemExtraction(
                        description=act_text,
                        assignee=assignee,
                        deadline=deadline,
                        priority="Medium",
                        source_segment_ids=chunk.segment_ids,
                        source_text=speech_body[:300],
                        start_time=chunk.start_time,
                        end_time=chunk.end_time,
                        confidence=0.88
                    ))
                    break

        # 2. Decisions (Strict Grounding)
        for pat in decision_patterns:
            m = pat.search(speech_body)
            if m:
                dec_text = m.group(0).strip()
                if len(dec_text) > 10:
                    decisions.append(DecisionExtraction(
                        decision=dec_text,
                        context=None,
                        impact=None,
                        source_segment_ids=chunk.segment_ids,
                        source_text=speech_body[:300],
                        start_time=chunk.start_time,
                        end_time=chunk.end_time,
                        confidence=0.88
                    ))
                    break

        # 3. Important Dates
        for pat in date_patterns:
            m = pat.search(speech_body)
            if m:
                date_str = m.group(0).strip()
                if len(date_str) > 3:
                    desc_text = speech_body[:120] if len(speech_body) > 10 else f"Date reference mentioned by {speaker_name}"
                    important_dates.append(ImportantDateExtraction(
                        raw_phrase=date_str,
                        normalized_date=None,
                        description=desc_text,
                        needs_confirmation=True,
                        source_segment_ids=chunk.segment_ids,
                        source_text=speech_body[:300],
                        start_time=chunk.start_time,
                        end_time=chunk.end_time,
                        confidence=0.85
                    ))
                    break

        # 4. Unresolved Questions
        if "?" in speech_body or any(speech_body.lower().startswith(q) for q in ["how ", "why ", "what if ", "who will ", "is there ", "should we "]):
            unresolved_questions.append(UnresolvedQuestionExtraction(
                question=speech_body,
                raised_by=speaker_name,
                context=None,
                source_segment_ids=chunk.segment_ids,
                source_text=speech_body[:300],
                start_time=chunk.start_time,
                end_time=chunk.end_time,
                confidence=0.85
            ))

    # 5. Key Points (Directly from substantive sentences)
    if substantive_sentences:
        for sent in substantive_sentences[:3]:
            if any(w in sent.lower() for w in ["we", "our", "project", "system", "feature", "client", "market", "test", "build", "release", "team", "product", "design", "plan", "data", "problem", "solution"]):
                key_points.append(KeyPointExtraction(
                    point=sent,
                    category="Discussion Topic",
                    source_segment_ids=chunk.segment_ids,
                    source_text=sent[:300],
                    start_time=chunk.start_time,
                    end_time=chunk.end_time,
                    confidence=0.85
                ))

        if not key_points and substantive_sentences:
            key_points.append(KeyPointExtraction(
                point=substantive_sentences[0],
                category="Discussion Topic",
                source_segment_ids=chunk.segment_ids,
                source_text=substantive_sentences[0][:300],
                start_time=chunk.start_time,
                end_time=chunk.end_time,
                confidence=0.80
            ))

    # 6. Takeaways (Strictly from substantive sentences)
    if substantive_sentences:
        takeaways.append(TakeawayExtraction(
            takeaway=substantive_sentences[0][:200],
            category="Discussion Topic",
            source_segment_ids=chunk.segment_ids,
            source_text=substantive_sentences[0][:300],
            start_time=chunk.start_time,
            end_time=chunk.end_time,
            confidence=0.85
        ))

    # 7. Partial Summary (Factual transcript sentence concatenation)
    if substantive_sentences:
        partial_summary = " ".join(substantive_sentences[:2])
    else:
        partial_summary = ""

    return ChunkAnalysis(
        chunk_index=chunk.chunk_index,
        partial_summary=partial_summary,
        key_points=key_points,
        decisions=decisions,
        action_items=action_items,
        important_dates=important_dates,
        scheduled_events=scheduled_events,
        takeaways=takeaways,
        unresolved_questions=unresolved_questions
    )


class LLMService:
    def __init__(self):
        self.client = OllamaClient()

    async def analyze_chunk(
        self,
        chunk: TranscriptChunk,
        meeting_title: str,
        meeting_date_str: str
    ) -> Optional[ChunkAnalysis]:
        """Extract structured entities from a single transcript chunk with automatic fallback."""
        prompt = f"""
Meeting Title: {meeting_title}
Meeting Date Context: {meeting_date_str}
Chunk Index: {chunk.chunk_index} (Time: {chunk.start_time:.1f}s to {chunk.end_time:.1f}s)

TRANSCRIPT CHUNK:
{chunk.formatted_text}

Task: Extract structured information from this chunk.
Instructions:
- If an action item has no explicitly assigned owner or volunteer, set assignee to 'Unassigned'.
- If an action item has no stated deadline, set deadline to null. Never invent deadlines.
- If a decision has no discussed context or impact, set context and impact to null.
- Set source_segment_ids to {chunk.segment_ids} and cite exact source_text.

Return JSON with the following structure:
{{
  "chunk_index": {chunk.chunk_index},
  "partial_summary": "1-2 sentence factual summary of what was discussed in this section",
  "key_points": [
    {{ "point": "...", "category": "...", "source_segment_ids": {chunk.segment_ids}, "source_text": "...", "start_time": {chunk.start_time}, "end_time": {chunk.end_time}, "confidence": 0.95 }}
  ],
  "decisions": [
    {{ "decision": "...", "context": null, "impact": null, "source_segment_ids": {chunk.segment_ids}, "source_text": "...", "start_time": {chunk.start_time}, "end_time": {chunk.end_time}, "confidence": 0.95 }}
  ],
  "action_items": [
    {{ "description": "...", "assignee": "Unassigned", "deadline": null, "priority": "Low|Medium|High|Urgent", "source_segment_ids": {chunk.segment_ids}, "source_text": "...", "start_time": {chunk.start_time}, "end_time": {chunk.end_time}, "confidence": 0.95 }}
  ],
  "important_dates": [
    {{ "raw_phrase": "...", "normalized_date": "YYYY-MM-DD or null", "description": "...", "needs_confirmation": false, "source_segment_ids": {chunk.segment_ids}, "source_text": "...", "start_time": {chunk.start_time}, "end_time": {chunk.end_time}, "confidence": 0.95 }}
  ],
  "scheduled_events": [
    {{ "event_title": "...", "date_phrase": "...", "normalized_datetime": "...", "participants": ["..."], "source_segment_ids": {chunk.segment_ids}, "source_text": "...", "start_time": {chunk.start_time}, "end_time": {chunk.end_time}, "confidence": 0.95 }}
  ],
  "takeaways": [
    {{ "takeaway": "...", "category": "...", "source_segment_ids": {chunk.segment_ids}, "source_text": "...", "start_time": {chunk.start_time}, "end_time": {chunk.end_time}, "confidence": 0.95 }}
  ],
  "unresolved_questions": [
    {{ "question": "...", "raised_by": "...", "context": null, "source_segment_ids": {chunk.segment_ids}, "source_text": "...", "start_time": {chunk.start_time}, "end_time": {chunk.end_time}, "confidence": 0.95 }}
  ]
}}
"""
        result = await self.client.generate_json(prompt, ChunkAnalysis)
        if result:
            return result

        # Grounded heuristic fallback extraction (never hallucinates)
        return heuristic_extract_chunk(chunk, meeting_title, meeting_date_str)

    async def synthesize_analysis(
        self,
        chunks_analysis: List[ChunkAnalysis],
        meeting_title: str,
        meeting_date_str: str,
        speakers_list: List[str]
    ) -> Optional[MeetingAnalysis]:
        """
        Synthesize final coherent executive summary, deduplicated decisions, action items,
        dates, questions, and sentiment report from all chunk-level extractions without silent truncation.
        """
        chunk_summaries = [f"- Section {c.chunk_index}: {c.partial_summary}" for c in chunks_analysis if c.partial_summary]
        
        # Deduplication helper
        def dedupe_items(items: List[dict], key: str) -> List[dict]:
            seen = set()
            unique = []
            for item in items:
                val = (item.get(key) or "").strip().lower()
                if val and val not in seen:
                    seen.add(val)
                    unique.append(item)
            return unique

        all_key_points = dedupe_items([kp.model_dump() for c in chunks_analysis for kp in c.key_points], "point")
        all_decisions = dedupe_items([d.model_dump() for c in chunks_analysis for d in c.decisions], "decision")
        all_action_items = dedupe_items([a.model_dump() for c in chunks_analysis for a in c.action_items], "description")
        all_dates = dedupe_items([d.model_dump() for c in chunks_analysis for d in c.important_dates], "raw_phrase")
        all_events = dedupe_items([e.model_dump() for c in chunks_analysis for e in c.scheduled_events], "event_title")
        all_takeaways = dedupe_items([t.model_dump() for c in chunks_analysis for t in c.takeaways], "takeaway")
        all_questions = dedupe_items([q.model_dump() for c in chunks_analysis for q in c.unresolved_questions], "question")

        synthesis_prompt = f"""
Meeting Title: {meeting_title}
Meeting Date Context: {meeting_date_str}
Participants: {', '.join(speakers_list) if speakers_list else 'Participants'}

SECTION-BY-SECTION SUMMARIES:
{chr(10).join(chunk_summaries) if chunk_summaries else "No section summaries."}

CANDIDATE EXTRACTIONS FROM TRANSCRIPT:
Key Points: {json.dumps(all_key_points)}
Decisions: {json.dumps(all_decisions)}
Action Items: {json.dumps(all_action_items)}
Dates: {json.dumps(all_dates)}
Events: {json.dumps(all_events)}
Takeaways: {json.dumps(all_takeaways)}
Questions: {json.dumps(all_questions)}

Task: Synthesize a factual, cohesive meeting intelligence analysis document.
Critical Grounding Rules:
- Do NOT invent any action item, decision, assignee, or deadline not found in the candidate extractions.
- If an action item does not have an explicitly named owner, keep assignee as 'Unassigned'.
- If an action item has no explicit deadline, keep deadline as null.
- Include ALL valid decisions and action items; do not omit or truncate items.

Return JSON matching this schema:
{{
  "executive_summary": "Comprehensive factual summary covering objectives, discussions, decisions, and next steps.",
  "agenda_topics": ["Topic 1", "Topic 2", ...],
  "key_points": [ ... all deduplicated key points ... ],
  "decisions": [ ... all deduplicated concrete decisions ... ],
  "action_items": [ ... all deduplicated action items ... ],
  "important_dates": [ ... important dates ... ],
  "scheduled_events": [ ... scheduled events ... ],
  "takeaways": [ ... high-level takeaways ... ],
  "unresolved_questions": [ ... open unanswered questions ... ],
  "sentiment": {{
    "overall_sentiment_estimate": "Factual tone observation",
    "justification": "Evidence-based justification",
    "speaker_estimates": [
      {{ "speaker_label": "...", "estimated_tone": "...", "observation": "..." }}
    ]
  }}
}}
"""
        result = await self.client.generate_json(synthesis_prompt, MeetingAnalysis)
        
        # Grounded fallback if LLM synthesis is unavailable
        if result is None:
            logger.info("Assembling grounded synthesis directly from extractions without hallucination.")
            
            summary_sections = [c.partial_summary.strip() for c in chunks_analysis if c.partial_summary and c.partial_summary.strip()]
            if summary_sections:
                executive_summary = "\n\n".join(summary_sections)
            else:
                executive_summary = f"Summary for '{meeting_title}' on {meeting_date_str}."

            agenda_topics = []
            for kp in all_key_points:
                cat = kp.get("category", "")
                if cat and cat not in ["General", "Discussion Topic"] and cat not in agenda_topics:
                    agenda_topics.append(cat)
            if not agenda_topics:
                agenda_topics = ["General Discussion"]

            return MeetingAnalysis(
                executive_summary=executive_summary,
                agenda_topics=agenda_topics,
                key_points=[KeyPointExtraction(**kp) for kp in all_key_points],
                decisions=[DecisionExtraction(**d) for d in all_decisions],
                action_items=[ActionItemExtraction(**a) for a in all_action_items],
                important_dates=[ImportantDateExtraction(**dt) for dt in all_dates],
                scheduled_events=[ScheduledEventExtraction(**ev) for ev in all_events],
                takeaways=[TakeawayExtraction(**tk) for tk in all_takeaways],
                unresolved_questions=[UnresolvedQuestionExtraction(**q) for q in all_questions],
                sentiment=None
            )
            
        return result

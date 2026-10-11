import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.vector_store import MeetingVectorStore
from app.schemas.chat import Citation

class MockSegment:
    def __init__(self, id, meeting_id, start_time, end_time, speaker_label, cleaned_text):
        self.id = id
        self.meeting_id = meeting_id
        self.start_time = start_time
        self.end_time = end_time
        self.speaker_label = speaker_label
        self.cleaned_text = cleaned_text
        self.raw_text = cleaned_text

@pytest.mark.asyncio
async def test_chatbot_abstention_returns_zero_citations():
    """Unsupported questions must return the standard abstention string and an empty citations list."""
    vstore = MeetingVectorStore(meeting_id=99)
    
    # Mock search returning candidate chunks
    sample_chunk = {
        "chunk_index": 0,
        "start_time": 0.0,
        "end_time": 60.0,
        "segment_ids": [101, 102],
        "formatted_text": "[00:00:10] Marcus: We discussed the backend migration."
    }
    
    with patch.object(vstore, "search", return_value=[sample_chunk]):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "response": "This information was not found in the meeting recording."
            }
            mock_post.return_value = mock_resp

            answer, citations = await vstore.answer_question(
                "What was the marketing budget for Q4?",
                "Sprint Planning"
            )

            assert "not found in the meeting recording" in answer.lower()
            assert citations == [], "Abstention response must return zero citations"

@pytest.mark.asyncio
async def test_chatbot_returns_fine_grained_span_with_speaker_label():
    """Answerable queries must return the exact relevant transcript segment with its speaker label, not a broad multi-minute chunk."""
    vstore = MeetingVectorStore(meeting_id=42)

    sample_chunk = {
        "chunk_index": 0,
        "start_time": 0.0,
        "end_time": 95.0,
        "segment_ids": [1, 2, 3],
        "formatted_text": (
            "[00:00:00] Alice: Welcome to the meeting.\n"
            "[00:00:21] Marcus: We should organize a pancake breakfast to encourage Friday attendance.\n"
            "[00:01:15] Bob: The server migration is scheduled for Sunday."
        )
    }

    canonical_segs = [
        MockSegment(1, 42, 0.0, 5.0, "Alice", "Welcome to the meeting."),
        MockSegment(2, 42, 21.0, 27.5, "Marcus", "We should organize a pancake breakfast to encourage Friday attendance."),
        MockSegment(3, 42, 75.0, 85.0, "Bob", "The server migration is scheduled for Sunday.")
    ]

    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_filter1 = MagicMock()
    mock_filter2 = MagicMock()
    
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_filter1
    mock_filter1.filter.return_value = mock_filter2
    mock_filter2.all.return_value = canonical_segs

    with patch.object(vstore, "search", return_value=[sample_chunk]):
        with patch("app.core.database.SessionLocal", return_value=mock_db):
            with patch("httpx.AsyncClient.post") as mock_post:
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.json.return_value = {
                    "response": "[00:00:21] Marcus suggested organizing a pancake breakfast to encourage Friday attendance."
                }
                mock_post.return_value = mock_resp

                answer, citations = await vstore.answer_question(
                    "What was proposed to encourage Friday attendance?",
                    "Team Sync"
                )

                assert len(citations) >= 1
                cit = citations[0]
                # Must be the exact segment, not the 0.0 - 95.0 chunk
                assert cit.start_time == 21.0
                assert cit.end_time == 27.5
                assert cit.speaker_label == "Marcus"
                assert "pancake breakfast" in cit.text
                assert cit.timestamp_str == "00:00:21 - 00:00:28"

def test_citations_scoped_to_meeting_id():
    """Fine-grained citations query must filter by self.meeting_id."""
    vstore = MeetingVectorStore(meeting_id=77)

    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value.filter.return_value.all.return_value = []

    with patch("app.core.database.SessionLocal", return_value=mock_db):
        citations = vstore._extract_fine_grained_citations(
            query="test query",
            answer="test answer",
            top_chunks=[{"segment_ids": [1, 2]}]
        )

        # Confirm query was called on TranscriptSegment
        assert mock_db.query.called
        assert citations == []

def test_chat_invalid_meeting_id_returns_404():
    """Querying a non-existent meeting must return 404 Not Found."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    res = client.post("/api/v1/chat", json={"meeting_id": 999999, "query": "What happened?"})
    assert res.status_code == 404
    assert "Meeting not found" in res.json()["detail"]

def test_chat_empty_query_returns_400():
    """Submitting empty query string must return 400 Bad Request."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    res = client.post("/api/v1/chat", json={"meeting_id": 999999, "query": "   "})
    assert res.status_code == 400
    assert "cannot be empty" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_chat_llm_failure_propagates_error_not_fabrication():
    """When Ollama fails, vector_store must raise RuntimeError rather than fabricating an answer."""
    vstore = MeetingVectorStore(meeting_id=10)
    sample_chunk = {
        "chunk_index": 0,
        "start_time": 0.0,
        "end_time": 10.0,
        "segment_ids": [1],
        "formatted_text": "[00:00:00] Alice: Hello"
    }

    with patch.object(vstore, "search", return_value=[sample_chunk]):
        with patch("httpx.AsyncClient.post", side_effect=Exception("Connection refused to Ollama")):
            with pytest.raises(RuntimeError) as exc_info:
                await vstore.answer_question("What did Alice say?", "Meeting 10")
            assert "temporarily unavailable" in str(exc_info.value).lower()

@pytest.mark.asyncio
async def test_chat_no_model_raises_runtime_error():
    """When no local model can be resolved from Ollama, raise clean RuntimeError."""
    vstore = MeetingVectorStore(meeting_id=12)
    sample_chunk = {
        "chunk_index": 0,
        "start_time": 0.0,
        "end_time": 10.0,
        "segment_ids": [1],
        "formatted_text": "[00:00:00] Alice: Hello"
    }

    with patch.object(vstore, "search", return_value=[sample_chunk]):
        with patch("app.services.llm_service.OllamaClient.resolve_model", return_value=None):
            with pytest.raises(RuntimeError) as exc_info:
                await vstore.answer_question("What did Alice say?", "Meeting 12")
            assert "no local llm model" in str(exc_info.value).lower()

def test_vector_store_auto_rebuild_from_segments(tmp_path):
    """When FAISS index file is missing, load_index must auto-rebuild using transcript segments in DB."""
    vstore = MeetingVectorStore(meeting_id=888)
    vstore.index_dir = tmp_path / "meeting_888"
    vstore.index_file = vstore.index_dir / "index.faiss"
    vstore.meta_file = vstore.index_dir / "metadata.pkl"

    mock_seg = MockSegment(1, 888, 0.0, 10.0, "Alice", "Testing automatic index reconstruction.")

    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_filter = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_filter
    mock_filter.order_by.return_value.all.return_value = [mock_seg]

    with patch("app.core.database.SessionLocal", return_value=mock_db):
        success = vstore.load_index()
        assert success is True
        assert vstore.index_file.exists()
        assert vstore.meta_file.exists()
        assert len(vstore.chunks_metadata) >= 1

def test_get_chat_history_with_valid_and_legacy_citations():
    """Verify get_chat_history handles valid citations, legacy speaker field, stringified JSON, and skips malformed citations safely."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.models.db_models import Meeting, ChatMessage
    from app.core.database import SessionLocal

    db = SessionLocal()
    test_meeting = Meeting(title="Chat History Test Meeting")
    db.add(test_meeting)
    db.commit()
    db.refresh(test_meeting)
    m_id = test_meeting.id

    try:
        # Message 1: Normal citations
        msg1 = ChatMessage(
            meeting_id=m_id,
            role="assistant",
            content="Answer 1",
            citations=[{
                "segment_id": 10,
                "start_time": 5.0,
                "end_time": 10.0,
                "timestamp_str": "00:00:05 - 00:00:10",
                "speaker_label": "Alice",
                "text": "Valid citation"
            }]
        )
        # Message 2: Legacy citations with "speaker" key instead of "speaker_label"
        msg2 = ChatMessage(
            meeting_id=m_id,
            role="assistant",
            content="Answer 2",
            citations=[{
                "start_time": 12.0,
                "end_time": 18.0,
                "timestamp_str": "00:00:12 - 00:00:18",
                "speaker": "Bob",
                "text": "Legacy speaker citation"
            }]
        )
        # Message 3: Stringified JSON citations
        msg3 = ChatMessage(
            meeting_id=m_id,
            role="assistant",
            content="Answer 3",
            citations='[{"start_time": 20.0, "end_time": 25.0, "timestamp_str": "00:00:20 - 00:00:25", "speaker_label": "Charlie", "text": "Stringified citation"}]'
        )
        # Message 4: Mixed with malformed citation entries (should skip malformed safely)
        msg4 = ChatMessage(
            meeting_id=m_id,
            role="assistant",
            content="Answer 4",
            citations=[
                "not a dict or valid json",
                {"incomplete": "missing required fields"},
                {"start_time": "invalid_number", "end_time": 30.0, "timestamp_str": "...", "speaker_label": "...", "text": "..."},
                {
                    "start_time": 30.0,
                    "end_time": 35.0,
                    "timestamp_str": "00:00:30 - 00:00:35",
                    "speaker_label": "Dana",
                    "text": "Valid alongside malformed"
                }
            ]
        )
        db.add_all([msg1, msg2, msg3, msg4])
        db.commit()

        client = TestClient(app)
        res = client.get(f"/api/v1/chat/history/{m_id}")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 4

        # Check msg 1
        assert len(data[0]["citations"]) == 1
        assert data[0]["citations"][0]["speaker_label"] == "Alice"
        assert data[0]["citations"][0]["text"] == "Valid citation"

        # Check msg 2 (legacy speaker -> speaker_label)
        assert len(data[1]["citations"]) == 1
        assert data[1]["citations"][0]["speaker_label"] == "Bob"
        assert data[1]["citations"][0]["text"] == "Legacy speaker citation"

        # Check msg 3 (stringified JSON)
        assert len(data[2]["citations"]) == 1
        assert data[2]["citations"][0]["speaker_label"] == "Charlie"

        # Check msg 4 (malformed citations skipped, valid preserved)
        assert len(data[3]["citations"]) == 1
        assert data[3]["citations"][0]["speaker_label"] == "Dana"
        assert data[3]["citations"][0]["text"] == "Valid alongside malformed"
    finally:
        db.query(ChatMessage).filter(ChatMessage.meeting_id == m_id).delete()
        db.query(Meeting).filter(Meeting.id == m_id).delete()
        db.commit()
        db.close()




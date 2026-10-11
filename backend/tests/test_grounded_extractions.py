import pytest
from unittest.mock import AsyncMock, patch
from app.services.chunker import TranscriptChunk
from app.services.llm_service import (
    LLMService,
    heuristic_extract_chunk,
    OllamaClient
)
from app.services.pipeline_worker import is_valid_content
from app.schemas.analysis import (
    ChunkAnalysis,
    ActionItemExtraction,
    DecisionExtraction,
    MeetingAnalysis
)

def create_sample_chunk(text: str, chunk_index: int = 0) -> TranscriptChunk:
    return TranscriptChunk(
        chunk_index=chunk_index,
        start_time=10.0,
        end_time=35.0,
        segment_ids=[1, 2],
        formatted_text=text,
        word_count=len(text.split())
    )

def test_action_item_missing_owner_assigns_unassigned():
    """Action items without an explicitly identified owner must be labeled 'Unassigned'."""
    text = "[00:00:10] Team Member: We need to update the configuration documentation before next quarter."
    chunk = create_sample_chunk(text)
    
    result = heuristic_extract_chunk(chunk, "Sprint Review", "2026-10-10")
    
    assert len(result.action_items) >= 1
    action = result.action_items[0]
    assert action.assignee == "Unassigned"
    assert "update the configuration documentation" in action.description

def test_action_item_explicit_owner_preserved():
    """Action items with an explicit volunteer or assignee must preserve that owner."""
    # 1. Known speaker with 1st-person commitment
    text1 = "[00:00:10] Marcus: I will prepare the deployment script and test harness."
    chunk1 = create_sample_chunk(text1)
    result1 = heuristic_extract_chunk(chunk1, "Sprint Review", "2026-10-10")
    assert len(result1.action_items) >= 1
    assert result1.action_items[0].assignee == "Marcus"

    # 2. Assigned to specific name
    text2 = "[00:00:15] Lead: Please assign to Sarah: review the audit log requirements."
    chunk2 = create_sample_chunk(text2)
    result2 = heuristic_extract_chunk(chunk2, "Sprint Review", "2026-10-10")
    assert len(result2.action_items) >= 1
    assert result2.action_items[0].assignee == "Sarah"

def test_action_item_missing_deadline_is_none():
    """Action items without a stated deadline must have deadline=None, never boilerplate filler."""
    text = "[00:00:10] Marcus: I will optimize the query indexes."
    chunk = create_sample_chunk(text)
    
    result = heuristic_extract_chunk(chunk, "Sprint Review", "2026-10-10")
    
    assert len(result.action_items) >= 1
    action = result.action_items[0]
    assert action.deadline is None
    # Must never be filler
    assert action.deadline != "As discussed in session"

def test_action_item_explicit_deadline_preserved():
    """Explicitly spoken deadlines must be captured accurately."""
    text = "[00:00:10] Marcus: I will deliver the benchmark report by Friday."
    chunk = create_sample_chunk(text)
    
    result = heuristic_extract_chunk(chunk, "Sprint Review", "2026-10-10")
    
    assert len(result.action_items) >= 1
    action = result.action_items[0]
    assert action.deadline is not None
    assert "by Friday" in action.deadline

def test_decision_without_context_or_impact_is_none():
    """Decisions without explicit context or impact must set context=None and impact=None."""
    text = "[00:00:10] Alex: We decided to deploy SQLite in Write-Ahead Logging mode."
    chunk = create_sample_chunk(text)
    
    result = heuristic_extract_chunk(chunk, "Sprint Review", "2026-10-10")
    
    assert len(result.decisions) >= 1
    decision = result.decisions[0]
    assert "SQLite" in decision.decision
    assert decision.context is None
    assert decision.impact is None
    # Must never invent boilerplate impact
    assert decision.impact != "Sets direction and guidance for upcoming deliverables."

@pytest.mark.asyncio
async def test_malformed_llm_json_fallback_recovery():
    """When LLM returns malformed JSON or times out, analyze_chunk falls back safely without hallucination."""
    llm = LLMService()
    
    # Mock OllamaClient.generate_json to simulate parse/network failure
    with patch.object(OllamaClient, "generate_json", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = None
        
        text = "[00:00:10] Marcus: I will configure the GPU memory ceiling."
        chunk = create_sample_chunk(text)
        
        result = await llm.analyze_chunk(chunk, "Architecture Review", "2026-10-10")
        
        assert result is not None
        assert isinstance(result, ChunkAnalysis)
        assert len(result.action_items) >= 1
        assert result.action_items[0].assignee == "Marcus"
        assert result.action_items[0].deadline is None

@pytest.mark.asyncio
async def test_synthesis_no_silent_truncation():
    """Synthesis must preserve all deduplicated action items and decisions without truncating to 10 or 15."""
    llm = LLMService()
    
    # Create 22 distinct action items and 18 distinct decisions across 3 chunks
    chunks_analysis = []
    for i in range(3):
        acts = [
            ActionItemExtraction(
                description=f"Task {i}-{j}: Complete item number {i*10 + j}",
                assignee="Unassigned",
                deadline=None,
                priority="Medium",
                source_segment_ids=[1],
                source_text="source evidence",
                start_time=1.0,
                end_time=2.0
            )
            for j in range(8)
        ]
        decs = [
            DecisionExtraction(
                decision=f"Decision {i}-{j}: Approved RFC number {i*10 + j}",
                context=None,
                impact=None,
                source_segment_ids=[1],
                source_text="source evidence",
                start_time=1.0,
                end_time=2.0
            )
            for j in range(6)
        ]
        chunks_analysis.append(ChunkAnalysis(
            chunk_index=i,
            partial_summary=f"Section {i} reviewed architecture.",
            key_points=[],
            decisions=decs,
            action_items=acts,
            important_dates=[],
            scheduled_events=[],
            takeaways=[],
            unresolved_questions=[]
        ))

    # Mock LLM synthesis returning None to test grounded synthesis aggregation
    with patch.object(OllamaClient, "generate_json", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = None
        
        analysis = await llm.synthesize_analysis(
            chunks_analysis,
            "Major Review",
            "2026-10-10",
            ["Marcus", "Alex"]
        )
        
        assert analysis is not None
        # All 24 action items and 18 decisions must be preserved, NOT truncated to 15 or 10!
        assert len(analysis.action_items) == 24
        assert len(analysis.decisions) == 18
        # Boilerplate filler must not be in summary
        assert "During the 'Major Review' session" not in analysis.executive_summary

def test_is_valid_content_filters_boilerplate():
    """is_valid_content must reject invented boilerplate phrases and accept valid content."""
    assert is_valid_content("As discussed in session") is False
    assert is_valid_content("as discussed") is False
    assert is_valid_content("Sets direction and guidance for upcoming deliverables.") is False
    assert is_valid_content("TBD") is False
    assert is_valid_content("None specified") is False
    assert is_valid_content("Unassigned") is False
    assert is_valid_content(None) is False
    assert is_valid_content("") is False

    # Valid items
    assert is_valid_content("October 25, 2026") is True
    assert is_valid_content("Deploy SQLite with WAL mode") is True
    assert is_valid_content("Marcus Vance") is True

class DummySegment:
    def __init__(self, id, start_time, end_time, speaker_label, cleaned_text):
        self.id = id
        self.start_time = start_time
        self.end_time = end_time
        self.speaker_label = speaker_label
        self.cleaned_text = cleaned_text

def test_plausible_but_unsupported_decision_rejected():
    """A plausible decision that introduces claims absent from the canonical evidence must be rejected."""
    from app.services.grounding_verifier import verify_decisions

    canonical = [
        DummySegment(1, 0.0, 5.0, "Speaker A", "Thanks for coming and if no one has anything else I think we can wrap up.")
    ]

    # Plausible sounding decision, but completely absent from evidence
    dec = DecisionExtraction(
        decision="We decided to migrate our entire database infrastructure to PostgreSQL.",
        source_text="Thanks for coming and if no one has anything else I think we can wrap up.",
        start_time=0.0,
        end_time=5.0
    )

    verified = verify_decisions([dec], canonical)
    assert len(verified) == 0, "Plausible but unsupported decision must be rejected"

def test_mismatched_evidence_quote_rejected():
    """A claim whose evidence quote is mismatched or does not semantically entail the claim must be rejected."""
    from app.services.grounding_verifier import verify_decisions

    canonical = [
        DummySegment(1, 10.0, 15.0, "Speaker A", "We decided to put up posters with tips for not getting sick.")
    ]

    # Mismatched claim
    dec = DecisionExtraction(
        decision="Approved marketing campaign budget of 50,000 dollars for Q4.",
        source_text="We decided to put up posters with tips for not getting sick.",
        start_time=10.0,
        end_time=15.0
    )

    verified = verify_decisions([dec], canonical)
    assert len(verified) == 0, "Decision with mismatched evidence quote must be rejected"

def test_invented_owner_reset_to_unassigned():
    """When an action item's owner is not mentioned in the supporting evidence quote or speaker turn, reset to Unassigned."""
    from app.services.grounding_verifier import verify_action_items

    canonical = [
        DummySegment(
            1, 20.0, 26.0, "Unknown Speaker",
            "It might be good if we did something like a pancake breakfast to encourage them to come."
        )
    ]

    # Invented owner 'Sarah'
    act = ActionItemExtraction(
        description="Organize a pancake breakfast to encourage students to attend.",
        assignee="Sarah",
        deadline=None,
        source_text="It might be good if we did something like a pancake breakfast to encourage them to come.",
        start_time=20.0,
        end_time=26.0
    )

    verified = verify_action_items([act], canonical)
    assert len(verified) == 1
    assert verified[0].assignee == "Unassigned", "Invented owner must be reset to Unassigned"

def test_invented_deadline_reset_to_none():
    """When an action item's deadline is fabricated and absent from the supporting evidence quote, reset to None."""
    from app.services.grounding_verifier import verify_action_items

    canonical = [
        DummySegment(
            1, 20.0, 26.0, "Unknown Speaker",
            "It might be good if we did something like a pancake breakfast to encourage them to come."
        )
    ]

    # Invented deadline 'by December 31st'
    act = ActionItemExtraction(
        description="Organize a pancake breakfast to encourage students to attend.",
        assignee="Unassigned",
        deadline="by December 31st",
        source_text="It might be good if we did something like a pancake breakfast to encourage them to come.",
        start_time=20.0,
        end_time=26.0
    )

    verified = verify_action_items([act], canonical)
    assert len(verified) == 1
    assert verified[0].deadline is None, "Invented deadline must be reset to None"

def test_fabricated_evidence_quote_rejected():
    """When an evidence quote does not exist anywhere in the canonical transcript, reject the claim."""
    from app.services.grounding_verifier import verify_decisions

    canonical = [
        DummySegment(1, 0.0, 5.0, "Speaker A", "Hello everyone welcome to the meeting.")
    ]

    # Fabricated evidence quote not in canonical transcript
    dec = DecisionExtraction(
        decision="All employees must work from the office on Tuesdays.",
        source_text="From now on all employees must work from the office on Tuesdays without exception.",
        start_time=0.0,
        end_time=5.0
    )

    verified = verify_decisions([dec], canonical)
    assert len(verified) == 0, "Claim with fabricated quote not in transcript must be rejected"


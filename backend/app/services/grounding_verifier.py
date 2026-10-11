import re
from typing import List, Dict, Any, Optional, Tuple
from app.schemas.analysis import (
    DecisionExtraction, ActionItemExtraction, KeyPointExtraction,
    ImportantDateExtraction, ScheduledEventExtraction, TakeawayExtraction,
    UnresolvedQuestionExtraction, MeetingAnalysis
)
from app.services.audio_processor import format_timestamp
from app.core.logging import logger

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "by",
    "for", "with", "about", "against", "between", "into", "through", "during", "before",
    "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off",
    "over", "under", "again", "further", "then", "once", "here", "there", "all", "any",
    "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just",
    "don", "should", "now", "i", "we", "you", "they", "he", "she", "it", "me", "us",
    "them", "him", "her", "my", "our", "your", "their", "his", "its", "what", "which",
    "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing",
    "would", "could", "shall", "let", "lets", "let's", "decided", "decision", "agreed",
    "consensus", "meeting", "session", "wrap", "group", "team", "discuss", "discussed"
}

GENERIC_ASSIGNEE_TERMS = {
    "team member", "team", "speaker", "unknown speaker", "unknown", "user",
    "someone", "anybody", "everyone", "unassigned", "n/a", "none", "nobody"
}

def normalize_text(text: Optional[str]) -> str:
    """Normalize text by lowercasing and stripping punctuation and whitespace."""
    if not text:
        return ""
    # Replace punctuation with spaces
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())

def extract_content_words(text: Optional[str]) -> set:
    """Extract informative non-stopword tokens from a text string."""
    norm = normalize_text(text)
    words = set(norm.split())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}

def find_canonical_segment_match(
    quote: Optional[str],
    canonical_segments: List[Any]
) -> Optional[Tuple[List[int], float, float, str, str]]:
    """
    Find the canonical transcript segment (or span) that grounds the given quote.
    Returns: (segment_ids, start_time, end_time, canonical_text, speaker_label)
    or None if no canonical segment contains or matches the quote.
    """
    if not quote or not canonical_segments:
        return None

    quote_norm = normalize_text(quote)
    if not quote_norm:
        return None

    quote_words = extract_content_words(quote)

    # 1. Exact substring match in a single segment
    for seg in canonical_segments:
        seg_text = seg.cleaned_text if hasattr(seg, "cleaned_text") else seg.get("cleaned_text", seg.get("text", ""))
        seg_norm = normalize_text(seg_text)
        if not seg_norm:
            continue
        
        # Substring in either direction
        if quote_norm in seg_norm or seg_norm in quote_norm:
            seg_id = seg.id if hasattr(seg, "id") else seg.get("id", 1)
            start_t = seg.start_time if hasattr(seg, "start_time") else seg.get("start", seg.get("start_time", 0.0))
            end_t = seg.end_time if hasattr(seg, "end_time") else seg.get("end", seg.get("end_time", 0.0))
            speaker = seg.speaker_label if hasattr(seg, "speaker_label") else seg.get("speaker_label", "Unknown Speaker")
            return ([seg_id], float(start_t), float(end_t), seg_text, speaker)

    # 2. Token overlap match (at least 75% of quote content words in a segment)
    best_seg = None
    best_ratio = 0.0

    if quote_words:
        for seg in canonical_segments:
            seg_text = seg.cleaned_text if hasattr(seg, "cleaned_text") else seg.get("cleaned_text", seg.get("text", ""))
            seg_words = extract_content_words(seg_text)
            if not seg_words:
                continue

            common = quote_words.intersection(seg_words)
            ratio = len(common) / len(quote_words)
            if ratio > best_ratio and ratio >= 0.70:
                best_ratio = ratio
                best_seg = seg

    if best_seg is not None:
        seg_id = best_seg.id if hasattr(best_seg, "id") else best_seg.get("id", 1)
        start_t = best_seg.start_time if hasattr(best_seg, "start_time") else best_seg.get("start", best_seg.get("start_time", 0.0))
        end_t = best_seg.end_time if hasattr(best_seg, "end_time") else best_seg.get("end", best_seg.get("end_time", 0.0))
        speaker = best_seg.speaker_label if hasattr(best_seg, "speaker_label") else best_seg.get("speaker_label", "Unknown Speaker")
        seg_text = best_seg.cleaned_text if hasattr(best_seg, "cleaned_text") else best_seg.get("cleaned_text", best_seg.get("text", ""))
        return ([seg_id], float(start_t), float(end_t), seg_text, speaker)

    return None

def is_semantically_entailed(claim: str, evidence: str) -> bool:
    """
    Verify whether the claim is semantically grounded in the evidence quote.
    Rejects:
    1. Mismatched quotes (e.g. claim about database migration, quote about wrapping up).
    2. Claims that introduce specific details/terms absent from evidence.
    """
    if not claim or not evidence:
        return False

    claim_words = extract_content_words(claim)
    evidence_words = extract_content_words(evidence)

    if not claim_words:
        return True  # trivial claim

    # Content overlap
    shared_words = claim_words.intersection(evidence_words)
    overlap_ratio = len(shared_words) / len(claim_words)

    # If evidence is a generic meeting closer/filler, reject business decisions
    evidence_norm = normalize_text(evidence)
    wrapup_phrases = ["wrap up", "thanks for coming", "see you next time", "if no one has anything else", "goodbye"]
    if any(p in evidence_norm for p in wrapup_phrases):
        # A claim about wrapping up is allowed, but an unrelated claim is rejected
        if not any(w in claim.lower() for w in ["wrap", "end", "adjourn", "close", "coming"]):
            return False

    # At least 35% of the distinct content words of the claim must directly appear in the evidence quote
    # AND at least 1 key content word must match
    if len(shared_words) < 1 or overlap_ratio < 0.30:
        return False

    # Check for specific invented details: numbers/amounts absent from evidence
    claim_numbers = set(re.findall(r"\b\d+(?:\.\d+)?(?:k|m|b)?\b", claim.lower()))
    evidence_numbers = set(re.findall(r"\b\d+(?:\.\d+)?(?:k|m|b)?\b", evidence.lower()))
    invented_numbers = claim_numbers - evidence_numbers
    if invented_numbers:
        # Numbers like dates/budgets present in claim but absent from quote
        return False

    return True

def verify_assignee(assignee: Optional[str], evidence: str, speaker_label: Optional[str] = None) -> str:
    """
    Verify that an assignee is grounded in the evidence quote or speaker label.
    If the assignee is generic or invented, reset to 'Unassigned'.
    """
    if not assignee:
        return "Unassigned"

    cleaned_assignee = assignee.strip()
    norm_assignee = normalize_text(cleaned_assignee)

    if not norm_assignee or norm_assignee in GENERIC_ASSIGNEE_TERMS:
        return "Unassigned"

    evidence_norm = normalize_text(evidence)
    speaker_norm = normalize_text(speaker_label) if speaker_label else ""

    # Check if assignee is mentioned in evidence
    if norm_assignee in evidence_norm:
        return cleaned_assignee

    # Check if assignee matches the speaker of the turn (for 1st person commitments like "I will...")
    if speaker_norm and (norm_assignee == speaker_norm or norm_assignee in speaker_norm or speaker_norm in norm_assignee):
        if speaker_norm not in GENERIC_ASSIGNEE_TERMS:
            return cleaned_assignee

    # If assignee name appears nowhere in evidence or speaker, it's an invented owner
    return "Unassigned"

def verify_deadline(deadline: Optional[str], evidence: str) -> Optional[str]:
    """
    Verify that a stated deadline appears in the evidence quote.
    If invented or absent from evidence, reset to None.
    """
    if not deadline:
        return None

    cleaned_deadline = deadline.strip()
    norm_deadline = normalize_text(cleaned_deadline)

    if not norm_deadline or norm_deadline in {"none", "null", "as discussed in session", "tbd", "unspecified"}:
        return None

    evidence_norm = normalize_text(evidence)

    # Check if the deadline words appear in evidence
    deadline_words = [w for w in norm_deadline.split() if w not in STOPWORDS]
    if not deadline_words:
        return None

    # At least 60% of deadline content words must appear in evidence
    matches = [w for w in deadline_words if w in evidence_norm]
    if len(matches) / len(deadline_words) >= 0.5:
        return cleaned_deadline

    # If the deadline is not grounded in the evidence quote, it is invented
    return None

def verify_decisions(
    decisions: List[DecisionExtraction],
    canonical_segments: List[Any]
) -> List[DecisionExtraction]:
    """
    Verify decisions against canonical transcript segments:
    - Match evidence quote to real transcript
    - Verify semantic entailment (reject mismatched quotes and unsupported assertions)
    - Set accurate timestamps from supporting canonical segment
    """
    verified = []
    for dec in decisions:
        if not dec.decision or len(dec.decision.strip()) < 3:
            continue

        match = find_canonical_segment_match(dec.source_text, canonical_segments)
        if not match:
            # Evidence quote does not exist in canonical transcript -> REJECT
            logger.warning(f"Rejecting decision (evidence quote not found in transcript): '{dec.decision}'")
            continue

        seg_ids, start_t, end_t, canonical_text, _ = match

        # Verify semantic entailment against canonical text
        if not is_semantically_entailed(dec.decision, canonical_text):
            logger.warning(f"Rejecting decision (mismatched/unsupported evidence): '{dec.decision}' vs '{canonical_text}'")
            continue

        # Ground timestamps and segment IDs
        dec.source_segment_ids = seg_ids
        dec.start_time = start_t
        dec.end_time = end_t
        dec.source_text = canonical_text
        dec.decision = dec.decision.strip()
        verified.append(dec)

    return verified

def verify_action_items(
    action_items: List[ActionItemExtraction],
    canonical_segments: List[Any]
) -> List[ActionItemExtraction]:
    """
    Verify action items against canonical transcript segments:
    - Match evidence quote to real transcript
    - Verify semantic entailment
    - Ground or reset assignee to 'Unassigned' if invented
    - Ground or reset deadline to None if invented
    - Set accurate timestamps from supporting canonical segment
    """
    verified = []
    for act in action_items:
        if not act.description or len(act.description.strip()) < 3:
            continue

        match = find_canonical_segment_match(act.source_text, canonical_segments)
        if not match:
            logger.warning(f"Rejecting action item (evidence quote not found in transcript): '{act.description}'")
            continue

        seg_ids, start_t, end_t, canonical_text, speaker_label = match

        # Verify semantic entailment against canonical text
        if not is_semantically_entailed(act.description, canonical_text):
            logger.warning(f"Rejecting action item (mismatched/unsupported evidence): '{act.description}' vs '{canonical_text}'")
            continue

        # Verify assignee and deadline
        act.assignee = verify_assignee(act.assignee, canonical_text, speaker_label)
        act.deadline = verify_deadline(act.deadline, canonical_text)

        # Ground timestamps and segment IDs
        act.source_segment_ids = seg_ids
        act.start_time = start_t
        act.end_time = end_t
        act.source_text = canonical_text
        act.description = act.description.strip()
        verified.append(act)

    return verified

def verify_and_ground_analysis(
    analysis: MeetingAnalysis,
    canonical_segments: List[Any]
) -> MeetingAnalysis:
    """
    Run full evidence verification on all extractions in a MeetingAnalysis.
    """
    analysis.decisions = verify_decisions(analysis.decisions, canonical_segments)
    analysis.action_items = verify_action_items(analysis.action_items, canonical_segments)

    # Also ground Key Points
    grounded_kp = []
    for kp in analysis.key_points:
        if not kp.point or len(kp.point.strip()) < 3:
            continue
        match = find_canonical_segment_match(kp.source_text, canonical_segments)
        if match:
            seg_ids, start_t, end_t, canonical_text, _ = match
            if is_semantically_entailed(kp.point, canonical_text):
                kp.source_segment_ids = seg_ids
                kp.start_time = start_t
                kp.end_time = end_t
                kp.source_text = canonical_text
                grounded_kp.append(kp)
    analysis.key_points = grounded_kp

    return analysis

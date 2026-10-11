import re
from typing import List, Dict, Any, Tuple
from app.core.logging import logger

def _find_speaker_for_interval(
    start: float,
    end: float,
    speaker_turns: List[Dict[str, Any]],
    unique_speakers: List[str]
) -> Tuple[str, List[str]]:
    """
    Find best matching speaker for a given time interval.
    Returns (primary_speaker, overlapping_speakers).
    """
    mid = (start + end) / 2.0
    overlapping = []
    best_speaker = None
    max_overlap = -1.0

    for turn in speaker_turns:
        t_start = turn["start"]
        t_end = turn["end"]
        spk = turn["speaker"]
        overlap = max(0.0, min(end, t_end) - max(start, t_start))
        if overlap > 0.0:
            if spk not in overlapping:
                overlapping.append(spk)
            if overlap > max_overlap:
                max_overlap = overlap
                best_speaker = spk

    if best_speaker:
        return best_speaker, overlapping

    # If no direct overlap, check which turn midpoint is closest
    best_dist = float("inf")
    for turn in speaker_turns:
        t_mid = (turn["start"] + turn["end"]) / 2.0
        dist = abs(t_mid - mid)
        if dist < best_dist:
            best_dist = dist
            best_speaker = turn["speaker"]

    if best_speaker is None and unique_speakers:
        best_speaker = unique_speakers[0]
    elif best_speaker is None:
        best_speaker = "SPEAKER_00"

    return best_speaker, overlapping

def align_transcript_with_speakers(
    transcript_segments: List[Dict[str, Any]],
    speaker_turns: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """
    Assign transcript segments (and words where present) to speaker turns.
    When word timestamps exist, splits multi-speaker segments at exact word boundaries.
    
    Returns:
    - aligned_segments: List of segment dicts with 'speaker_tag', 'speaker_label', 'words', etc.
    - speaker_stats: Dict of speaker_tag -> {display_name, speaking_time, turns, avg_turn, percentage}
    """
    if not transcript_segments:
        return [], {}

    # If no speaker turns from diarization, assign single Unknown Speaker gracefully
    if not speaker_turns:
        aligned_segments = []
        for i, seg in enumerate(transcript_segments):
            seg_copy = dict(seg)
            seg_copy["speaker_tag"] = "SPEAKER_00"
            seg_copy["speaker_label"] = "Unknown Speaker"
            seg_copy["cleaned_text"] = re.sub(r'\s+', ' ', seg.get("text", "")).strip()
            aligned_segments.append(seg_copy)

        total_time = sum(s["end"] - s["start"] for s in transcript_segments)
        speaker_stats = {
            "SPEAKER_00": {
                "speaker_tag": "SPEAKER_00",
                "display_name": "Unknown Speaker",
                "speaking_time_seconds": round(total_time, 2),
                "speaking_percentage": 100.0,
                "turn_count": len(transcript_segments),
                "avg_turn_seconds": round(total_time / max(1, len(transcript_segments)), 2)
            }
        }
        return aligned_segments, speaker_stats

    # Map raw speaker tags (e.g. "SPEAKER_00", "SPEAKER_01") to user-friendly labels
    unique_speakers = sorted(list(set(t["speaker"] for t in speaker_turns)))
    speaker_tag_to_label = {tag: f"Speaker {idx + 1}" for idx, tag in enumerate(unique_speakers)}

    # Check if word-level timestamps are available across segments
    has_words = any(bool(seg.get("words")) for seg in transcript_segments)

    if not has_words:
        # Fallback for coarse segments without word arrays
        aligned_segments = []
        speaker_durations = {tag: 0.0 for tag in unique_speakers}
        speaker_turns_count = {tag: 0 for tag in unique_speakers}
        last_speaker_tag = None

        for seg in transcript_segments:
            s_start = seg["start"]
            s_end = seg["end"]
            s_dur = max(0.01, s_end - s_start)

            best_speaker, _ = _find_speaker_for_interval(s_start, s_end, speaker_turns, unique_speakers)
            speaker_tag_to_label.setdefault(best_speaker, f"Speaker {len(speaker_tag_to_label) + 1}")
            speaker_label = speaker_tag_to_label[best_speaker]

            speaker_durations[best_speaker] = speaker_durations.get(best_speaker, 0.0) + s_dur
            if best_speaker != last_speaker_tag:
                speaker_turns_count[best_speaker] = speaker_turns_count.get(best_speaker, 0) + 1
                last_speaker_tag = best_speaker

            seg_copy = dict(seg)
            seg_copy["speaker_tag"] = best_speaker
            seg_copy["speaker_label"] = speaker_label
            seg_copy["cleaned_text"] = re.sub(r'\s+', ' ', seg.get("text", "")).strip()
            aligned_segments.append(seg_copy)
    else:
        # Fine-grained word-level boundary alignment
        aligned_segments = []
        speaker_durations = {tag: 0.0 for tag in unique_speakers}
        speaker_turns_count = {tag: 0 for tag in unique_speakers}

        current_words = []
        current_speaker = None
        current_confidences = []

        def flush_subsegment():
            nonlocal current_words, current_speaker, current_confidences
            if not current_words:
                return

            sub_text = "".join(w["word"] for w in current_words).strip()
            if not sub_text:
                current_words = []
                current_confidences = []
                return

            sub_start = current_words[0]["start"]
            sub_end = current_words[-1]["end"]
            avg_conf = sum(current_confidences) / len(current_confidences) if current_confidences else 0.95

            speaker_tag_to_label.setdefault(current_speaker, f"Speaker {len(speaker_tag_to_label) + 1}")
            spk_label = speaker_tag_to_label[current_speaker]

            s_dur = max(0.01, sub_end - sub_start)
            speaker_durations[current_speaker] = speaker_durations.get(current_speaker, 0.0) + s_dur
            speaker_turns_count[current_speaker] = speaker_turns_count.get(current_speaker, 0) + 1

            aligned_segments.append({
                "start": round(sub_start, 2),
                "end": round(sub_end, 2),
                "text": sub_text,
                "cleaned_text": re.sub(r'\s+', ' ', sub_text).strip(),
                "confidence": round(avg_conf, 3),
                "speaker_tag": current_speaker,
                "speaker_label": spk_label,
                "words": list(current_words)
            })

            current_words = []
            current_confidences = []

        for seg in transcript_segments:
            words = seg.get("words")
            if not words:
                # If a specific segment has no words, treat as single unit
                best_spk, _ = _find_speaker_for_interval(seg["start"], seg["end"], speaker_turns, unique_speakers)
                if current_speaker != best_spk:
                    flush_subsegment()
                    current_speaker = best_spk
                current_words.append({
                    "word": " " + seg["text"].strip(),
                    "start": seg["start"],
                    "end": seg["end"],
                    "probability": seg.get("confidence", 0.95)
                })
                current_confidences.append(seg.get("confidence", 0.95))
                continue

            for w in words:
                w_start = w["start"]
                w_end = w["end"]
                w_spk, _ = _find_speaker_for_interval(w_start, w_end, speaker_turns, unique_speakers)

                # Split if speaker changes or long pause (> 1.8s) occurs
                pause_detected = current_words and (w_start - current_words[-1]["end"] > 1.8)

                if current_speaker is None:
                    current_speaker = w_spk
                elif current_speaker != w_spk or pause_detected:
                    flush_subsegment()
                    current_speaker = w_spk

                current_words.append(w)
                current_confidences.append(w.get("probability", 1.0))

        flush_subsegment()

    total_speech_time = sum(speaker_durations.values())
    if total_speech_time <= 0:
        total_speech_time = 1.0

    speaker_stats = {}
    for tag in unique_speakers:
        duration = speaker_durations.get(tag, 0.0)
        turns = max(1 if duration > 0 else 0, speaker_turns_count.get(tag, 0))
        percentage = round((duration / total_speech_time) * 100.0, 1)
        speaker_stats[tag] = {
            "speaker_tag": tag,
            "display_name": speaker_tag_to_label.get(tag, tag),
            "speaking_time_seconds": round(duration, 2),
            "speaking_percentage": percentage,
            "turn_count": turns,
            "avg_turn_seconds": round(duration / turns, 2) if turns > 0 else 0.0
        }

    return aligned_segments, speaker_stats

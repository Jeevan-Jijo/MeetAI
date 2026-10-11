"""
Controlled End-to-End Acceptance Test for MIS Phase 2.1
Tests the complete application workflow using the local recording 'Weekly Meeting Example.mp3'.
"""
import os
import sys
import json
import asyncio
import time
from fastapi.testclient import TestClient

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath("."))
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

from app.main import app
from app.core.database import SessionLocal
from app.models.db_models import (
    Meeting, ProcessingJob, TranscriptSegment, Speaker,
    MeetingSummary, KeyPoint, Decision, ActionItem, ImportantDate, ScheduledEvent
)
from app.services.pipeline_worker import process_meeting_pipeline

AUDIO_FILE = os.path.abspath("data/uploads/cc6ee510868841288a9fc85f95867de0_Weekly Meeting Example.mp3")

async def run_e2e_acceptance_test():
    print("=" * 80, flush=True)
    print("MIS PHASE 2.1: CONTROLLED END-TO-END ACCEPTANCE TEST", flush=True)
    print("=" * 80, flush=True)
    print(f"Test audio file: {AUDIO_FILE}", flush=True)
    print(f"File exists: {os.path.exists(AUDIO_FILE)} ({os.path.getsize(AUDIO_FILE)} bytes)", flush=True)

    client = TestClient(app)

    # 1. Upload recording via API (TestClient processes background pipeline tasks automatically)
    print("\n--- STAGE 1 & 2: UPLOADING RECORDING VIA API & PROCESSING WORKFLOW ---")
    t0 = time.perf_counter()
    with open(AUDIO_FILE, "rb") as f:
        response = client.post(
            "/api/v1/meetings/upload",
            data={
                "title": "Weekly Student Success Meeting (E2E Test)",
                "description": "Controlled acceptance test run for MIS Phase 2.1"
            },
            files={"file": ("Weekly Meeting Example.mp3", f, "audio/mpeg")}
        )

    t_total = time.perf_counter() - t0
    assert response.status_code == 200, f"Upload failed: {response.text}"
    upload_data = response.json()
    meeting_id = upload_data["meeting_id"]
    job_id = upload_data["job_id"]
    print(f"Upload and processing complete in {t_total:.2f}s: Meeting ID = {meeting_id}, Job ID = {job_id}")

    # 3. Retrieve database records and job logs
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()

        print(f"\nFinal Meeting Status: {meeting.status}")
        print(f"Final Job Status: {job.status}")
        print(f"Meeting Duration: {meeting.duration_seconds:.2f}s")

        print("\n--- PIPELINE EXECUTION LOGS & STAGE TIMINGS ---")
        for log in (job.logs or []):
            print(f"  {log}")

        # 4. Check Diarization and Speakers
        print("\n--- STAGE 3: DIARIZATION & SPEAKER ATTRIBUTION INSPECTION ---")
        speakers = db.query(Speaker).filter(Speaker.meeting_id == meeting_id).all()
        print(f"Total Speakers Detected in DB: {len(speakers)}")
        for spk in speakers:
            print(f"  Speaker: tag={spk.speaker_tag}, name={spk.display_name}, speaking_time={spk.speaking_time_seconds:.2f}s, turns={spk.turn_count}")

        # 5. Check Transcript Segments
        print("\n--- STAGE 4: TRANSCRIPT ACCURACY & TIMESTAMPS INSPECTION ---")
        segments = db.query(TranscriptSegment).filter(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.start_time).all()
        print(f"Total Transcript Segments: {len(segments)}")
        for i, seg in enumerate(segments[:8]):
            print(f"  [{seg.start_time:6.2f}s - {seg.end_time:6.2f}s] [{seg.speaker_label}]: {seg.cleaned_text}")
        if len(segments) > 8:
            print(f"  ... ({len(segments) - 8} more segments)")

        # 6. Check Extracted Meeting Intelligence
        print("\n--- STAGE 5: GROUNDED INTELLIGENCE INSPECTION ---")
        summary = db.query(MeetingSummary).filter(MeetingSummary.meeting_id == meeting_id).first()
        if summary:
            print(f"Executive Summary:\n{summary.executive_summary}\n")
            print(f"Sentiment: {summary.overall_sentiment_estimate} (Justification: {summary.sentiment_justification})")

        decisions = db.query(Decision).filter(Decision.meeting_id == meeting_id).all()
        print(f"\nDecisions ({len(decisions)}):")
        for dec in decisions:
            print(f"  - Decision: {dec.decision}")
            print(f"    Impact: {dec.impact}")
            print(f"    Evidence [{dec.start_time:.1f}s - {dec.end_time:.1f}s]: \"{dec.source_text}\"")

        action_items = db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).all()
        print(f"\nAction Items ({len(action_items)}):")
        for act in action_items:
            print(f"  - Task: {act.description}")
            print(f"    Assignee: {act.assignee}")
            print(f"    Deadline: {act.deadline}")
            print(f"    Priority: {act.priority}")
            print(f"    Evidence [{act.start_time:.1f}s - {act.end_time:.1f}s]: \"{act.source_text}\"")

        dates = db.query(ImportantDate).filter(ImportantDate.meeting_id == meeting_id).all()
        print(f"\nImportant Dates ({len(dates)}):")
        for dt in dates:
            print(f"  - Phrase: {dt.raw_phrase} | Normalized: {dt.normalized_date} | Desc: {dt.description}")

        # 7. Ask Chatbot Questions
        print("\n--- STAGE 6: RAG CHATBOT EVALUATION ---")
        # Question 1: Answerable
        q1 = "What was suggested to encourage students to attend on Fridays?"
        print(f"\n[Test Query 1 (Answerable)]: \"{q1}\"")
        r1 = client.post("/api/v1/chat", json={"meeting_id": meeting_id, "query": q1})
        assert r1.status_code == 200, f"Chat query 1 failed: {r1.text}"
        ans1 = r1.json()
        print(f"Chatbot Answer:\n{ans1['answer']}")
        print(f"Citations count: {len(ans1['citations'])}")
        for cit in ans1["citations"]:
            print(f"  Citation [{cit['timestamp_str']}] [{cit['speaker_label']}]: {cit['text']}")

        # Question 2: Absent from meeting
        q2 = "What was the marketing budget allocated for the Q4 European expansion?"
        print(f"\n[Test Query 2 (Absent/Unanswerable)]: \"{q2}\"")
        r2 = client.post("/api/v1/chat", json={"meeting_id": meeting_id, "query": q2})
        assert r2.status_code == 200, f"Chat query 2 failed: {r2.text}"
        ans2 = r2.json()
        print(f"Chatbot Answer:\n{ans2['answer']}")
        print(f"Citations count: {len(ans2['citations'])}")
        for cit in ans2["citations"]:
            print(f"  Citation [{cit['timestamp_str']}] [{cit['speaker_label']}]: {cit['text']}")

        # Summary outcome
        print("\n" + "=" * 80)
        print("ACCEPTANCE TEST EXECUTION COMPLETED")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_e2e_acceptance_test())

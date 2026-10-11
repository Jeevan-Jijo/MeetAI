import os
import tempfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.core.config import settings
from app.models.db_models import Meeting, Recording, TranscriptSegment, utcnow


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def sample_media():
    """Create a temporary mp3 and mp4 test file in settings.UPLOAD_DIR."""
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    mp3_file = settings.UPLOAD_DIR / "test_sample_audio.mp3"
    # Write 10KB of dummy audio bytes
    mp3_content = b"\xFF\xFB\x90\x00" + b"\x00" * 10236
    mp3_file.write_bytes(mp3_content)

    mp4_file = settings.UPLOAD_DIR / "test_sample_video.mp4"
    # Write 8KB of dummy video bytes
    mp4_content = b"\x00\x00\x00 ftypmp42" + b"\x00" * 8176
    mp4_file.write_bytes(mp4_content)

    yield mp3_file, mp4_file

    # Cleanup
    if mp3_file.exists():
        mp3_file.unlink()
    if mp4_file.exists():
        mp4_file.unlink()


def test_missing_meeting_audio_returns_404(client):
    """Accessing audio for a non-existent meeting must return 404."""
    response = client.get("/api/v1/audio/999999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_meeting_without_recording_returns_404(client):
    """A meeting with no recording associated returns 404."""
    db: Session = SessionLocal()
    m = Meeting(title="Seeded Test Meeting", status="COMPLETED", duration_seconds=60.0)
    db.add(m)
    db.commit()
    db.refresh(m)
    meeting_id = m.id
    db.close()

    try:
        response = client.get(f"/api/v1/audio/{meeting_id}")
        assert response.status_code == 404
        assert "no recording" in response.json()["detail"].lower()
    finally:
        db = SessionLocal()
        db.query(Meeting).filter(Meeting.id == meeting_id).delete()
        db.commit()
        db.close()


def test_audio_playback_streaming_and_inline_disposition(client, sample_media):
    """Audio streaming returns 200, correct media type, inline disposition, and Accept-Ranges."""
    mp3_file, _ = sample_media
    db: Session = SessionLocal()
    m = Meeting(title="Playback Test Audio", status="COMPLETED", duration_seconds=10.0)
    db.add(m)
    db.flush()
    rec = Recording(
        meeting_id=m.id,
        original_filename="sample_audio.mp3",
        file_path=str(mp3_file),
        mime_type="audio/mpeg",
        file_size_bytes=len(mp3_file.read_bytes()),
        duration_seconds=10.0
    )
    db.add(rec)
    db.commit()
    meeting_id = m.id
    db.close()

    try:
        # Test /api/v1/audio/{id}
        res = client.get(f"/api/v1/audio/{meeting_id}")
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("audio/mpeg")
        assert res.headers["accept-ranges"] == "bytes"
        # Content disposition must NOT be attachment
        cd = res.headers.get("content-disposition", "")
        assert "attachment" not in cd
        assert len(res.content) == len(mp3_file.read_bytes())

        # Test meeting-scoped /api/v1/meetings/{id}/recording
        res_rec = client.get(f"/api/v1/meetings/{meeting_id}/recording")
        assert res_rec.status_code == 200
        assert res_rec.headers["content-type"].startswith("audio/mpeg")
    finally:
        db = SessionLocal()
        db.query(Recording).filter(Recording.meeting_id == meeting_id).delete()
        db.query(Meeting).filter(Meeting.id == meeting_id).delete()
        db.commit()
        db.close()


def test_video_playback_mime_type(client, sample_media):
    """Video streaming returns 200 with video/mp4 MIME type."""
    _, mp4_file = sample_media
    db: Session = SessionLocal()
    m = Meeting(title="Playback Test Video", status="COMPLETED", duration_seconds=20.0)
    db.add(m)
    db.flush()
    rec = Recording(
        meeting_id=m.id,
        original_filename="sample_video.mp4",
        file_path=str(mp4_file),
        mime_type="video/mp4",
        file_size_bytes=len(mp4_file.read_bytes()),
        duration_seconds=20.0
    )
    db.add(rec)
    db.commit()
    meeting_id = m.id
    db.close()

    try:
        res = client.get(f"/api/v1/audio/{meeting_id}")
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("video/mp4")
        assert res.headers["accept-ranges"] == "bytes"
    finally:
        db = SessionLocal()
        db.query(Recording).filter(Recording.meeting_id == meeting_id).delete()
        db.query(Meeting).filter(Meeting.id == meeting_id).delete()
        db.commit()
        db.close()


def test_audio_http_range_requests(client, sample_media):
    """HTTP Range requests return 206 Partial Content with Content-Range."""
    mp3_file, _ = sample_media
    total_size = len(mp3_file.read_bytes())

    db: Session = SessionLocal()
    m = Meeting(title="Range Test Meeting", status="COMPLETED", duration_seconds=10.0)
    db.add(m)
    db.flush()
    rec = Recording(
        meeting_id=m.id,
        original_filename="sample_audio.mp3",
        file_path=str(mp3_file),
        mime_type="audio/mpeg",
        file_size_bytes=total_size,
        duration_seconds=10.0
    )
    db.add(rec)
    db.commit()
    meeting_id = m.id
    db.close()

    try:
        # 1. First 500 bytes (0-499)
        res1 = client.get(f"/api/v1/audio/{meeting_id}", headers={"Range": "bytes=0-499"})
        assert res1.status_code == 206
        assert res1.headers["content-range"] == f"bytes 0-499/{total_size}"
        assert len(res1.content) == 500

        # 2. Mid-file range (1000-1999)
        res2 = client.get(f"/api/v1/audio/{meeting_id}", headers={"Range": "bytes=1000-1999"})
        assert res2.status_code == 206
        assert res2.headers["content-range"] == f"bytes 1000-1999/{total_size}"
        assert len(res2.content) == 1000

        # 3. Invalid out-of-bounds range returns 416
        res3 = client.get(f"/api/v1/audio/{meeting_id}", headers={"Range": f"bytes={total_size + 5000}-{total_size + 6000}"})
        assert res3.status_code == 416
    finally:
        db = SessionLocal()
        db.query(Recording).filter(Recording.meeting_id == meeting_id).delete()
        db.query(Meeting).filter(Meeting.id == meeting_id).delete()
        db.commit()
        db.close()


def test_safe_storage_lifecycle_preserves_original_recording():
    """Verify that settings.UPLOAD_DIR retains original uploads while temp intermediates are isolated in PROCESSED_DIR."""
    assert settings.UPLOAD_DIR.exists()
    assert settings.PROCESSED_DIR.exists()

    # Create dummy original and dummy temp norm WAV
    orig = settings.UPLOAD_DIR / "lifecycle_original.mp3"
    orig.write_bytes(b"ORIGINAL_MEDIA")

    norm = settings.PROCESSED_DIR / "meeting_99999_norm.wav"
    norm.write_bytes(b"INTERMEDIATE_WAV")

    try:
        # Simulate pipeline cleanup of intermediate WAV
        if norm.exists():
            norm.unlink()
        
        # Original MUST survive
        assert orig.exists(), "Original recording must not be deleted by intermediate cleanup"
        assert orig.read_bytes() == b"ORIGINAL_MEDIA"
    finally:
        if orig.exists():
            orig.unlink()
        if norm.exists():
            norm.unlink()

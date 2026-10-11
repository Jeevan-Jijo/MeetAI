import os
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.logging import logger
from app.models.db_models import Meeting, Recording

router = APIRouter(prefix="/audio", tags=["Audio"])

MIME_MAP = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".opus": "audio/opus",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo"
}


def resolve_recording_path(rec: Recording) -> str | None:
    """Safely locate the recording media file on disk."""
    if not rec:
        return None

    # 1. Check exact file_path if it exists
    if rec.file_path and os.path.exists(rec.file_path):
        return rec.file_path

    # 2. Check candidate in configured UPLOAD_DIR with stored basename
    if rec.file_path:
        candidate = settings.UPLOAD_DIR / os.path.basename(rec.file_path)
        if candidate.exists():
            return str(candidate)

    # 3. Check candidate matching original_filename in UPLOAD_DIR
    if rec.original_filename:
        direct = settings.UPLOAD_DIR / rec.original_filename
        if direct.exists():
            return str(direct)

        # Search for uuid-prefixed files ending with original_filename
        if settings.UPLOAD_DIR.exists():
            for entry in settings.UPLOAD_DIR.iterdir():
                if entry.is_file() and entry.name.endswith(rec.original_filename):
                    return str(entry)

    return None


@router.get("/{meeting_id}")
def stream_meeting_audio(meeting_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Stream audio or video recording for playback in the web player.
    Supports HTTP Range requests (206 Partial Content) for seamless seeking.
    Uses inline content-disposition so browsers decode and play media directly.
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    rec = meeting.recording
    if not rec:
        raise HTTPException(status_code=404, detail="No recording associated with this meeting")

    path_to_serve = resolve_recording_path(rec)
    if not path_to_serve or not os.path.exists(path_to_serve):
        raise HTTPException(status_code=404, detail="Recording media file not found on server disk")

    # Sync relocated path back to DB record if changed
    if rec.file_path != path_to_serve:
        try:
            rec.file_path = path_to_serve
            db.commit()
        except Exception:
            db.rollback()

    ext = os.path.splitext(path_to_serve)[1].lower()
    media_type = MIME_MAP.get(ext) or rec.mime_type or mimetypes.guess_type(path_to_serve)[0] or "application/octet-stream"

    # Serve as inline media with Range support (no attachment disposition)
    return FileResponse(
        path=path_to_serve,
        media_type=media_type,
        content_disposition_type="inline",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
    )

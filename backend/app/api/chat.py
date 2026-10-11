import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.db_models import Meeting, ChatMessage, utcnow
from app.schemas.chat import ChatQueryRequest, ChatQueryResponse, ChatMessageRead, Citation
from app.services.vector_store import MeetingVectorStore

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("", response_model=ChatQueryResponse)
async def query_meeting_chatbot(payload: ChatQueryRequest, db: Session = Depends(get_db)):
    """Ask a question about a meeting and receive an evidence-backed answer with timestamp citations."""
    user_query = payload.query.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    meeting = db.query(Meeting).filter(Meeting.id == payload.meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Guard against querying meetings that are not completed
    if meeting.status in ["QUEUED", "TRANSCRIBING", "DIARIZING", "ALIGNING", "CHUNKING", "ANALYZING", "INDEXING"]:
        raise HTTPException(
            status_code=409,
            detail=f"Meeting is currently processing ({meeting.status.lower()}). Please wait until processing completes before asking questions."
        )
    if meeting.status == "FAILED":
        raise HTTPException(
            status_code=400,
            detail="Meeting processing failed. No transcript is available for Q&A."
        )

    # Check if any transcript exists for this meeting
    if not meeting.transcript_segments or len(meeting.transcript_segments) == 0:
        return ChatQueryResponse(
            answer="This meeting does not contain any transcribed speech to answer questions from.",
            citations=[],
            meeting_id=meeting.id,
            query=user_query
        )

    # Query Vector Store with robust error handling BEFORE committing
    vstore = MeetingVectorStore(meeting.id)
    try:
        answer, citations = await vstore.answer_question(user_query, meeting.title)
    except RuntimeError as r_err:
        raise HTTPException(status_code=503, detail=f"Local AI service unavailable: {str(r_err)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")

    # Convert citations to dicts for DB storage
    citations_data = [c.model_dump() for c in citations]

    # Atomically persist both user query and assistant response
    try:
        user_msg = ChatMessage(
            meeting_id=meeting.id,
            role="user",
            content=user_query,
            citations=[]
        )
        assistant_msg = ChatMessage(
            meeting_id=meeting.id,
            role="assistant",
            content=answer,
            citations=citations_data
        )
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()
    except Exception as db_err:
        db.rollback()

    return ChatQueryResponse(
        answer=answer,
        citations=citations,
        meeting_id=meeting.id,
        query=user_query
    )


@router.get("/history/{meeting_id}", response_model=List[ChatMessageRead])
def get_chat_history(meeting_id: int, db: Session = Depends(get_db)):
    """Fetch previous chat messages for this meeting."""
    messages = db.query(ChatMessage).filter(ChatMessage.meeting_id == meeting_id).order_by(ChatMessage.created_at).all()
    results = []
    for m in messages:
        citations: List[Citation] = []
        raw_citations = m.citations
        # Support string-serialized JSON in legacy database records
        if isinstance(raw_citations, str):
            try:
                raw_citations = json.loads(raw_citations)
            except (json.JSONDecodeError, TypeError, ValueError):
                raw_citations = []

        if isinstance(raw_citations, dict):
            raw_citations = [raw_citations]

        if isinstance(raw_citations, list):
            for c in raw_citations:
                try:
                    if isinstance(c, str):
                        try:
                            c = json.loads(c)
                        except (json.JSONDecodeError, TypeError, ValueError):
                            continue
                    if isinstance(c, dict):
                        citations.append(Citation.model_validate(c))
                    elif isinstance(c, Citation):
                        citations.append(c)
                except (ValidationError, TypeError, ValueError, KeyError):
                    # Safely skip malformed legacy citations without broad exception swallowing
                    continue

        results.append(ChatMessageRead(
            id=m.id,
            meeting_id=m.meeting_id,
            role=m.role,
            content=m.content,
            citations=citations,
            created_at=m.created_at
        ))
    return results


@router.delete("/history/{meeting_id}")
def clear_chat_history(meeting_id: int, db: Session = Depends(get_db)):
    """Clear chat conversation history for a meeting."""
    db.query(ChatMessage).filter(ChatMessage.meeting_id == meeting_id).delete()
    db.commit()
    return {"status": "cleared", "meeting_id": meeting_id}

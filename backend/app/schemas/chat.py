import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator

class Citation(BaseModel):
    segment_id: Optional[int] = None
    start_time: float
    end_time: float
    timestamp_str: str
    speaker_label: str
    text: str

    @model_validator(mode="before")
    @classmethod
    def handle_legacy_citation(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Compatibility with legacy citations that used "speaker" instead of "speaker_label"
            if "speaker_label" not in data and "speaker" in data:
                data = dict(data)
                data["speaker_label"] = str(data["speaker"])
        return data

class ChatQueryRequest(BaseModel):
    meeting_id: int
    query: str = Field(..., min_length=1)

class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: int
    role: str
    content: str
    citations: List[Citation] = []
    created_at: datetime.datetime

class ChatQueryResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    meeting_id: int
    query: str

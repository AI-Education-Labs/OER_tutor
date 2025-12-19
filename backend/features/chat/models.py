from pydantic import BaseModel
from typing import Optional, List

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: Optional[str] = None
    saved: bool = False

class ImportantMessage(BaseModel):
    role: str
    content: str

class ConversationSummaryUpdate(BaseModel):
    title: str
    summary: str
    important_messages: List[ImportantMessage]
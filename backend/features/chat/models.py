from pydantic import BaseModel, Field
from typing import Optional

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: Optional[str] = None
    saved: bool = False

class ChatRequest(BaseModel):
    user_message: str = Field(description="The message from the user")
    textbook_id: str = Field(description="The ID of the textbook being referenced")
    chapter_id: str = Field(description="The ID of the chapter being referenced")
    session_id: Optional[str] = Field(default=None, description="The session ID")
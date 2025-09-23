from pydantic import BaseModel
from typing import Optional

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: Optional[str] = None
    saved: bool = False
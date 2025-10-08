from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging
from pydantic import BaseModel
from backend.db.database import add_textbook_to_user, get_document_by_field
from backend.features.auth.service import validate_access_token

class AddTextbookRequest(BaseModel):
    code: str

class AddTextbookResponse(BaseModel):
    ok: bool
    textbook_id: Optional[str] = None
    title: Optional[str] = None
    error: Optional[str] = None

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/api/user_books/add", response_model=AddTextbookResponse)
async def add_user_textbook(payload: AddTextbookRequest, user_id: str = Depends(validate_access_token)):
    """Add a textbook to the authenticated user's library using a 6-char code."""
    textbook_code = (payload.code or "").strip().upper()

    # Check if the textbook ID is valid
    valid_textbook = await get_document_by_field("textbooks", "code", textbook_code)
    if(valid_textbook is None):
        # If no textbook exists, let the user know
        raise HTTPException(status_code=404, detail="Textbook not found")
    else:
        # If the textbook exists, add it to the user's books
        textbook_id = valid_textbook.get("_id")
        textbook_title = valid_textbook.get("title")
        print(f"Adding Textbook {textbook_title} ({textbook_id}) to user {user_id}")
        await add_textbook_to_user(user_id, textbook_id)
        return AddTextbookResponse(ok=True, textbook_id=textbook_id, title=textbook_title)
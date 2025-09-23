import logging

# Set up logging
logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
from backend.db.database import get_user_document, put_user_fields

router = APIRouter()

from backend.features.auth.service import validate_access_token

# Get user progress for the entirety of a specific textbook.
# Requires authentication.
@router.get("/{textbook_id}", response_model=float)
async def get_textbook_progress(
    textbook_id: str,
    current_user = Depends(validate_access_token)
):
    user_books = await get_user_document("user_books", current_user.id)
    if user_books is None:
        raise HTTPException(status_code=404, detail="User books not found")
    if textbook_id not in user_books.get(textbook_id, {}):
        raise HTTPException(status_code=404, detail="Textbook not found")
    
    total_progress = 0
    total_chapters = 0
    for chapter in user_books.get(textbook_id, {}).values():
        total_progress += chapter.get("progress", 0)
        total_chapters += 1
    return total_progress / total_chapters

# Get user progress for a specific chapter.
# Requires authentication.
@router.get("/{textbook_id}/chapter/{chapter_id}", response_model=float)
async def get_chapter_progress(
    textbook_id: str,
    chapter_id: str,
    current_user = Depends(validate_access_token)
):
    user_books = await get_user_document("user_books", current_user.id)
    if user_books is None:
        raise HTTPException(status_code=404, detail="User books not found")
    if textbook_id not in user_books.get(textbook_id, {}):
        raise HTTPException(status_code=404, detail="Textbook not found")
    if chapter_id not in user_books.get(textbook_id, {}):
        raise HTTPException(status_code=404, detail="Chapter not found")
    return user_books.get(textbook_id, {}).get(chapter_id, {}).get("progress", 0)

@router.patch("/{textbook_id}/chapter/{chapter_id}")
async def update_chapter_progress(
    textbook_id: str,
    chapter_id: str,
    progress_update: float,
    current_user = Depends(validate_access_token)
):
    response = await put_user_fields("user_books", current_user.id, {textbook_id: {chapter_id: {"progress": progress_update}}})
    if response is None:
        raise HTTPException(status_code=404, detail="User books not found")
    return response

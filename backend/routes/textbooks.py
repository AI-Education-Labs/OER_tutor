from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import logging
from backend.features.textbooks.models import Textbook
from pydantic import BaseModel
from backend.db.database import get_document, add_textbook_to_user
from backend.features.textbooks.repo import (
    find_textbook_by_code,
    find_textbook_by_id,
    find_textbooks_by_ids,
)
from backend.features.auth.service import validate_access_token_optional, validate_access_token
from backend.config import settings
from backend.db.s3_service import generate_presigned_get_url

S3_BUCKET = settings.S3_BUCKET

class TextbookResponse(BaseModel):
    textbooks: List[Textbook]
    is_authenticated: bool
    message: Optional[str] = None

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/list")
async def get_textbooks(user_uuid: str = Depends(validate_access_token_optional)):
    """Get all available textbooks."""
    print(f"get_textbooks: user {user_uuid}")
    # Check if user is authenticated
    is_authenticated = False
    available_textbooks: List[Textbook] = []
    message = "Sign in to see your textbooks!"

    if user_uuid:
        is_authenticated = True
        # Get the textbooks the user has access to
        user_textbooks_document = await get_document("user_books", user_uuid)
        if(user_textbooks_document is None):
            user_textbooks_document = {}

        user_textbook_ids = user_textbooks_document.get("textbooks", [])
        print(f"User {user_uuid} has the following textbooks -> {user_textbook_ids}")

        try:
            available_textbooks = await find_textbooks_by_ids(user_textbook_ids)
        except Exception as e:
            logger.error(f"Error getting textbook metadata for user {user_uuid}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error getting textbook metadata: {str(e)}")

    return TextbookResponse(
        textbooks=available_textbooks,
        is_authenticated=is_authenticated,
        message=message
    )

# TODO: These routes need to be protected
@router.get("/{textbook_uuid}")
async def get_textbook_details(textbook_uuid: str):
    textbook = await find_textbook_by_id(textbook_uuid)
    if textbook is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")
    return textbook
    

@router.get("/{textbook_uuid}/chapters")
async def get_chapters(textbook_uuid: str):
    """Get available chapters for a textbook.
    and returns a consistent response shape: { "chapters": [...] }.
    """
    textbook = await get_textbook_details(textbook_uuid)
    chapters = textbook.chapters or []

    return {"chapters": chapters}

@router.get("/{textbook_uuid}/chapters/{chapter_id}/pdf")
async def get_chapter_pdf(textbook_uuid: str, chapter_id: str):
    """Return a presigned URL to the chapter PDF stored in S3."""
    print(f"Getting chapter PDF for {textbook_uuid} and {chapter_id}")
    try:
        # --- keep your metadata lookup ---
        textbook = await get_textbook_details(textbook_uuid)
        chapters = textbook.chapters or []
        target_chapter = next(
            (c for c in chapters if str(c.id) == str(chapter_id)), None
        )
        if not target_chapter:
            logger.error(f"Chapter {chapter_id} not found in textbook {textbook_uuid}")
            raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")

        pdf_filename = target_chapter.file
        if not pdf_filename:
            logger.error(f"No PDF file specified for chapter {chapter_id}")
            raise HTTPException(status_code=404, detail=f"No PDF file found for chapter {chapter_id}")

        # --- S3 path ---
        key = f"{textbook_uuid}/{pdf_filename}"
        print(f"Searching for PDF in S3 at key: {key}")

        # Generate a presigned URL so the browser can open the PDF inline
        url = generate_presigned_get_url(
            key=key,
            bucket=S3_BUCKET,
            response_content_type="application/pdf",
            response_content_disposition=f'inline; filename="{pdf_filename}"',
            expires_in_seconds=3600,
        )
        print(f"Generated presigned URL for {pdf_filename}: {url}")

        return {
            "pdf_url": url,
            "chapter_title": target_chapter.title or f"Chapter {chapter_id}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chapter PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving chapter PDF: {str(e)}")
    


class AddTextbookRequest(BaseModel):
    code: str

class AddTextbookResponse(BaseModel):
    ok: bool
    textbook_id: Optional[str] = None
    title: Optional[str] = None
    error: Optional[str] = None

logger = logging.getLogger(__name__)

@router.post("/add", response_model=AddTextbookResponse)
async def add_user_textbook(payload: AddTextbookRequest, user_id: str = Depends(validate_access_token)):
    """Add a textbook to the authenticated user's library using a 6-char code."""
    textbook_code = (payload.code or "").strip().upper()

    # Check if the textbook ID is valid
    valid_textbook = await find_textbook_by_code(textbook_code)
    if(valid_textbook is None):
        # If no textbook exists, let the user know
        raise HTTPException(status_code=404, detail="Textbook not found")
    else:
        # If the textbook exists, add it to the user's books
        textbook_id = valid_textbook.id
        textbook_title = valid_textbook.title
        print(f"Adding Textbook {textbook_title} ({textbook_id}) to user {user_id}")
        await add_textbook_to_user(user_id, textbook_id)
        return AddTextbookResponse(ok=True, textbook_id=textbook_id, title=textbook_title)
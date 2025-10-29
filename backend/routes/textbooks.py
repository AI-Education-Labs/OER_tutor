from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import logging
from backend.features.textbooks.models import TextbookInfo
from pydantic import BaseModel
from backend.db.database import get_document, get_document_by_field
from backend.features.auth.service import validate_cookie_token
from botocore.exceptions import ClientError
from starlette.concurrency import run_in_threadpool
from backend.config.settings import settings
from backend.db.s3_service import generate_presigned_get_url, head_object, get_client, get_object_bytes

S3_BUCKET = settings.S3_BUCKET

class TextbookResponse(BaseModel):
    textbooks: List[TextbookInfo]

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_chapter_text(textbook_uuid: str, chapter_id: str) -> str:
    """Fetch chapter text content from S3 as UTF-8.

    Expects key pattern "{textbook_uuid}/chapter{chapter_id}.txt".
    """
    key = f"{textbook_uuid}/chapter{chapter_id}.txt"
    try:
        data = get_object_bytes(key)
        text = data.decode("utf-8", errors="replace")
        if not text:
            raise HTTPException(status_code=500, detail="Chapter text is empty")
        return text
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chapter text from S3 for key {key}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving chapter text: {str(e)}")

@router.get("/list")
async def get_textbooks(user_uuid: str = Depends(validate_cookie_token)):
    """Get all available textbooks."""
    print(f"get_textbooks: user {user_uuid}")
    # If user is unathenticated, return 401 unauthorized
    if user_uuid is None:
        message = "User is not authenticated. Returning public textbooks only."
        raise HTTPException(status_code=401, detail=message)

    if user_uuid:
        is_authenticated = True
        available_textbooks = []
        # Get the textbooks the user has access to
        user_textbooks_document = await get_document("user_books", user_uuid)
        if(user_textbooks_document is None):
            user_textbooks_document = {}

        user_textbook_ids = user_textbooks_document.get("textbooks", [])
        print(f"User {user_uuid} has the following textbooks -> {user_textbook_ids}")

        try:
            for textbook_id in user_textbook_ids:
                # TODO: We should promise.all this later
                if textbook_id is None:
                    continue
                else:
                    textbook_metadata = await get_document_by_field("textbooks", "_id", textbook_id)
                    available_textbooks.append(TextbookInfo(
                        id=textbook_metadata.get("_id"),
                        title=textbook_metadata.get("title"),
                        chapters=textbook_metadata.get("chapters"),
                        filepath=textbook_metadata.get("filepath"),
                        subject=textbook_metadata.get("subject"),
                        created_at=textbook_metadata.get("created_at"),
                        cover=textbook_metadata.get("cover"),
                    ))
        except Exception as e:
            logger.error(f"Error getting textbook metadata for {textbook_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error getting textbook metadata for {textbook_id}: {str(e)}")

    return TextbookResponse(
        textbooks=available_textbooks,
    )

# TODO: These routes need to be protected
@router.get("/{textbook_uuid}")
async def get_textbook_details(textbook_uuid: str):
    metadata = await get_document_by_field("textbooks", "_id", textbook_uuid)
    print(f"Textbook metadata: {metadata}")
    if metadata is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")
    return metadata
    

@router.get("/{textbook_uuid}/chapters")
async def get_chapters(textbook_uuid: str):
    """Get available chapters for a textbook.
    and returns a consistent response shape: { "chapters": [...] }.
    """
    textbook_metadata = await get_textbook_details(textbook_uuid)
    chapters = textbook_metadata.get("chapters", [])

    return {"chapters": chapters}

@router.get("/{textbook_uuid}/chapters/{chapter_id}/pdf")
async def get_chapter_pdf(textbook_uuid: str, chapter_id: str):
    """Return a presigned URL to the chapter PDF stored in S3."""
    print(f"Getting chapter PDF for {textbook_uuid} and {chapter_id}")
    try:
        # --- keep your metadata lookup ---
        textbook_metadata = await get_textbook_details(textbook_uuid)

        chapters = textbook_metadata.get("chapters", [])
        target_chapter = next(
            (c for c in chapters if str(c.get("id")) == str(chapter_id)), None
        )
        if not target_chapter:
            logger.error(f"Chapter {chapter_id} not found in textbook {textbook_uuid}")
            raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")

        pdf_filename = target_chapter.get("file")
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
            "chapter_title": target_chapter.get("title", f"Chapter {chapter_id}")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chapter PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving chapter PDF: {str(e)}")
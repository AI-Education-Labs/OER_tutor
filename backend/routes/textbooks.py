from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import logging
from beanie.operators import In
from pydantic import BaseModel
from backend.db.models import Textbook, User, BookProgress, Chapter
from backend.features.auth.service import validate_cookie_token
from botocore.exceptions import ClientError
from starlette.concurrency import run_in_threadpool
from backend.config.settings import settings
from backend.db.s3_service import generate_presigned_get_url, head_object, get_client, get_object_bytes

S3_BUCKET = settings.S3_BUCKET

router = APIRouter()
logger = logging.getLogger(__name__)

class Book(BaseModel):
    textbookInfo: Textbook
    userProgress: Optional[BookProgress] = None

# TODO: All these routes should be protected
# TODO: write tests for all of these
@router.get("/list", response_model=List[Book])
async def get_textbooks(user_uuid: str = Depends(validate_cookie_token)):
    """Get all available textbooks to the user."""
    response = []
    if not user_uuid:
        return response

    user: Optional[User] = await User.get(str(user_uuid))
    if not user or not user.books:
        return response

    textbook_codes = {book.textbook_id for book in user.books}
    if not textbook_codes:
        return response

    # find textbooks that match the user's book codes
    textbooks = await Textbook.find(In(Textbook.code, list(textbook_codes))).to_list()
    # return the users books with progress
    textbooks_by_code = {textbook.code: textbook for textbook in textbooks}
    # map userprogress next to textbook for response
    for book in sorted(user.books, key=lambda b: b.textbook_id):
        textbook = textbooks_by_code.get(book.textbook_id)
        if not textbook:
            continue
        response.append(Book(textbookInfo=textbook, userProgress=book.progress))

    return response


@router.get("/{textbook_uuid}", response_model=Textbook)
async def get_textbook_details(textbook_uuid: str, user_uuid: str = Depends(validate_cookie_token)):
    """Get metadata for a specific textbook."""
    book = await Textbook.get(textbook_uuid)
    if book is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")
    return book

@router.get("/{textbook_uuid}/chapters", response_model=List[Chapter])
async def get_chapters(textbook_uuid: str, user_uuid: str = Depends(validate_cookie_token)):
    """Get available chapters for a textbook.
    and returns a consistent response shape: { "chapters": [...] }.
    """
    textbook = await Textbook.get(textbook_uuid)
    if textbook is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")

    chapters = list(textbook.chapters)

    return chapters

class ChapterPDFResponse(BaseModel):
    pdf_url: str
    chapter_id: str

@router.get("/{textbook_uuid}/chapters/{chapter_id}/pdf", response_model=ChapterPDFResponse)
async def get_chapter_pdf(textbook_uuid: str, chapter_id: int):
    """Return a presigned URL to the chapter PDF stored in S3."""
    try:
        # --- keep your metadata lookup ---
        textbook = await Textbook.get(str(textbook_uuid))
        if textbook is None:
            raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")

        target_chapter = next(
            (c for c in textbook.chapters if c.id == chapter_id), None
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

        # Generate a presigned URL so the browser can open the PDF inline
        url = generate_presigned_get_url(
            key=key,
            bucket=S3_BUCKET,
            response_content_type="application/pdf",
            response_content_disposition=f'inline; filename="{pdf_filename}"',
            expires_in_seconds=3600,
        )

        return ChapterPDFResponse(
            pdf_url=url,
            chapter_id=str(chapter_id)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chapter PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving chapter PDF: {str(e)}")
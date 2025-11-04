from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import logging
from beanie.operators import In
from beanie import PydanticObjectId
from pydantic import BaseModel
from backend.db.models import Textbook, User, BookProgress, Chapter
from backend.db.models import Book as UserBook
from backend.features.auth.service import validate_cookie_token
from botocore.exceptions import ClientError
from starlette.concurrency import run_in_threadpool
from backend.config.settings import settings
from backend.db.s3_service import generate_presigned_get_url, head_object, get_client, get_object_bytes

S3_BUCKET = settings.S3_BUCKET

router = APIRouter()
logger = logging.getLogger(__name__)

def get_model_id(obj):
    """Helper to extract the id from Beanie/Pydantic models."""
    return str(getattr(obj, "id", getattr(obj, "_id", None)))

class Book(BaseModel):
    textbookInfo: Textbook
    userProgress: Optional[BookProgress] = None

@router.get("/list", response_model=List[Book])
async def get_textbooks(user_uuid: str = Depends(validate_cookie_token)):
    """Get all available textbooks to the user."""
    if not user_uuid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await User.get(str(user_uuid))
    if not user or not user.books:
        raise HTTPException(status_code=404, detail="User not found or has no books")

    textbook_ids = [book.textbook_id for book in user.books]
    
    # convert to ObjectId-like values so Beanie query matches stored Textbook.id
    try:
        textbook_oids = [PydanticObjectId(tid) for tid in textbook_ids]
    except Exception as e:
        logger.warning(f"Failed to convert textbook_ids to PydanticObjectId: {e}")
        # fallback: query by no conversion (safer than failing)
        textbook_oids = textbook_ids

    # fetch textbooks matching user's library
    textbooks = await Textbook.find(In(Textbook.id, textbook_oids)).to_list()
    response = []
    for textbook in textbooks:
        # Normalize textbook ID for comparison
        textbook_id = get_model_id(textbook)
        # find matching user book to include progress
        user_book = next((ub for ub in user.books if ub.textbook_id == textbook_id), None)
        progress = user_book.progress if user_book else None

        response.append(Book(textbookInfo=textbook, userProgress=progress))
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
    
class AddTextbookRequest(BaseModel):
    code: str

@router.post("/add")
async def add_textbook_to_user(req: AddTextbookRequest, user_uuid: str = Depends(validate_cookie_token)):
    """Add a textbook to the user's library by textbook code."""
    book = await Textbook.find_one(Textbook.code == req.code)
    if not book:
        raise HTTPException(status_code=404, detail="Textbook not found")

    # Normalize Beanie autogenerated id (PydanticObjectId / ObjectId-like) to a string
    textbook_id = get_model_id(book)
    if not textbook_id:
        raise HTTPException(status_code=500, detail="Could not determine textbook id")

    user = await User.get(str(user_uuid))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # ensure books list is initialized
    if not user.books:
        user.books = []

    # Check if the textbook is already in the user's library
    for user_book in user.books:
        if user_book.textbook_id == textbook_id:
            raise HTTPException(status_code=400, detail="Textbook already in user library")
    # Add the textbook to the user's library

    user.books.append(
        UserBook(
            textbook_id=textbook_id,
            progress=BookProgress(last_read_page=0, chapters={}, last_visited_chapter=0, last_visited_page=0),
        )
    )
    await user.save()
    return {"detail": "Textbook added to user library"}
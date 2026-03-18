from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import logging
import uuid
import string
import random
from datetime import datetime, timezone
from backend.features.textbooks.models import Textbook
from pydantic import BaseModel
from backend.db.database import get_collection, get_document, get_user_by_id, add_textbook_to_user
from backend.features.textbooks.repo import (
    find_textbook_by_code,
    find_textbook_by_id,
    find_textbooks_by_ids,
)
from backend.features.auth.service import validate_access_token_optional, validate_access_token
from backend.config import settings
from backend.db.s3_service import generate_presigned_get_url, generate_presigned_put_url

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

@router.get("/search")
async def search_textbooks(q: str = "", user_id: str = Depends(validate_access_token)):
    """Search textbooks by title, author, or code. Returns up to 20 matches."""
    collection = await get_collection("textbooks")
    query = q.strip()
    if not query:
        return {"textbooks": []}

    regex_filter = {
        "$or": [
            {"title": {"$regex": query, "$options": "i"}},
            {"author": {"$regex": query, "$options": "i"}},
            {"code": query.upper()},
        ]
    }
    cursor = collection.find(regex_filter).limit(20)
    docs = await cursor.to_list(length=20)
    textbooks = []
    for doc in docs:
        try:
            tb = Textbook.model_validate(doc)
            textbooks.append(tb.model_dump(by_alias=True))
        except Exception:
            continue
    return {"textbooks": textbooks}


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


# ── Textbook upload (professor) ──────────────────────────────────────────

class TextbookUploadRequest(BaseModel):
    title: str
    author: Optional[str] = None
    subject: Optional[str] = None


class TextbookUploadResponse(BaseModel):
    ok: bool
    textbook_id: str
    code: str
    upload_url: str


def _generate_textbook_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


@router.post("/upload", response_model=TextbookUploadResponse)
async def upload_textbook(payload: TextbookUploadRequest, user_id: str = Depends(validate_access_token)):
    """
    Create a new textbook record and return a presigned URL for the professor
    to upload the PDF. The textbook starts with no chapters; chapters can be
    added later once the PDF is processed.
    """
    user = await get_user_by_id(user_id)
    if not user or user.get("role") != "professor":
        raise HTTPException(status_code=403, detail="Only professors can upload textbooks")

    textbook_id = str(uuid.uuid4())
    code = _generate_textbook_code()

    textbook_doc = {
        "_id": textbook_id,
        "title": payload.title,
        "author": payload.author,
        "subject": payload.subject,
        "code": code,
        "chapters": [],
        "created_at": datetime.now(timezone.utc),
    }

    collection = await get_collection("textbooks")
    await collection.insert_one(textbook_doc)

    # Also add to the professor's own library
    await add_textbook_to_user(user_id, textbook_id)

    s3_key = f"{textbook_id}/original.pdf"
    upload_url = generate_presigned_put_url(
        key=s3_key,
        bucket=S3_BUCKET,
        content_type="application/pdf",
        expires_in_seconds=3600,
    )

    return TextbookUploadResponse(
        ok=True,
        textbook_id=textbook_id,
        code=code,
        upload_url=upload_url,
    )


@router.get("/{textbook_uuid}")
async def get_textbook_details(textbook_uuid: str, current_user: Optional[str] = Depends(validate_access_token_optional)):
    textbook = await find_textbook_by_id(textbook_uuid)
    if textbook is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")
    if textbook.view_type != "public" and current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required to access this textbook")
    return textbook


@router.get("/{textbook_uuid}/chapters")
async def get_chapters(textbook_uuid: str, current_user: Optional[str] = Depends(validate_access_token_optional)):
    """Get available chapters for a textbook.
    and returns a consistent response shape: { "chapters": [...] }.
    """
    textbook = await find_textbook_by_id(textbook_uuid)
    if textbook is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")
    if textbook.view_type != "public" and current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required to access this textbook")
    chapters = textbook.chapters or []

    return {"chapters": chapters}

@router.get("/{textbook_uuid}/chapters/{chapter_id}/pdf")
async def get_chapter_pdf(textbook_uuid: str, chapter_id: str, current_user: Optional[str] = Depends(validate_access_token_optional)):
    """Return a presigned URL to the chapter PDF stored in S3."""
    print(f"Getting chapter PDF for {textbook_uuid} and {chapter_id}")
    try:
        textbook = await find_textbook_by_id(textbook_uuid)
        if textbook is None:
            raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")
        if textbook.view_type != "public" and current_user is None:
            raise HTTPException(status_code=401, detail="Authentication required to access this textbook")
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
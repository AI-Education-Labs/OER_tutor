from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import os
import json
import logging
from backend.features.textbooks.models import TextbookInfo
from pydantic import BaseModel
from backend.db.database import get_document, get_document_by_field
from backend.features.auth.service import validate_access_token_optional
import boto3
from botocore.exceptions import ClientError
from starlette.concurrency import run_in_threadpool

S3_BUCKET = "textbooks-aie"
S3_PREFIX = "public/textbooks"
# Create S3 client (will use your AWS credentials from aws configure or env vars)
s3 = boto3.client("s3")

class TextbookResponse(BaseModel):
    textbooks: List[TextbookInfo]
    is_authenticated: bool
    message: Optional[str] = None

router = APIRouter()
logger = logging.getLogger(__name__)

PUBLIC_DIR = "./public"

@router.get("/api/textbooks")
async def get_textbooks(user_uuid: str = Depends(validate_access_token_optional)):
    """Get all available textbooks."""
    print(f"get_textbooks: user {user_uuid}")
    # Check if user is authenticated
    is_authenticated = False
    available_textbooks = []
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
            for textbook_id in user_textbook_ids:
                # TODO: We should promise.all this later
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
        is_authenticated=is_authenticated,
        message=message
    )

# TODO: These routes need to be protected
@router.get("/api/textbooks/{textbook_uuid}")
async def get_textbook_details(textbook_uuid: str):
    metadata = await get_document_by_field("textbooks", "_id", textbook_uuid)
    if metadata is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")
    return metadata
    

@router.get("/api/textbooks/{textbook_uuid}/chapters")
async def get_chapters(textbook_uuid: str):
    """Get available chapters for a textbook.
    and returns a consistent response shape: { "chapters": [...] }.
    """
    textbook_metadata = await get_textbook_details(textbook_uuid)
    chapters = textbook_metadata.get("chapters", [])

    return {"chapters": chapters}


""" @router.get("/api/textbooks/{textbook_uuid}/chapters/{chapter_id}/pdf")
async def get_chapter_pdf(textbook_uuid: str, chapter_id: str):
    Get the PDF file for a specific chapter by looking up the filename in metadata.
    try:
        ##################
        # Local Approach #
        ##################

        # Get the textbook directory
        textbook_dir = os.path.join(PUBLIC_DIR, "textbooks", textbook_uuid)
        
        # Check if the directory exists
        if not os.path.isdir(textbook_dir):
            logger.error(f"Textbook directory not found: {textbook_dir}")
            raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_uuid}")

        textbook_metadata = await get_textbook_details(textbook_uuid)

        # Find the chapter with the matching ID
        chapters = textbook_metadata.get("chapters", [])
        target_chapter = None
        
        for chapter in chapters:
            if str(chapter.get("id")) == str(chapter_id):
                target_chapter = chapter
                break
        
        if not target_chapter:
            logger.error(f"Chapter {chapter_id} not found in textbook {textbook_uuid}")
            raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")
        
        # Get the PDF filename from the chapter metadata
        pdf_filename = target_chapter.get("file")
        if not pdf_filename:
            logger.error(f"No PDF file specified for chapter {chapter_id}")
            raise HTTPException(status_code=404, detail=f"No PDF file found for chapter {chapter_id}")
        
        # Construct the full path to the PDF
        pdf_path = os.path.join(textbook_dir, pdf_filename)
        
        # Check if the PDF file exists
        if not os.path.isfile(pdf_path):
            logger.error(f"PDF file not found: {pdf_path}")
            raise HTTPException(status_code=404, detail=f"PDF file not found: {pdf_filename}")
        
        ##################
        # S3 Approach  -> Change The following line to fetch from S3 instead of local filesystem
        ##################

        # Return the relative URL path that the frontend can use
        pdf_url = f"/textbooks/{textbook_uuid}/{pdf_filename}"
        

        return {"pdf_url": pdf_url, "chapter_title": target_chapter.get("title", f"Chapter {chapter_id}")}
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error getting chapter PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving chapter PDF: {str(e)}") """

@router.get("/api/textbooks/{textbook_uuid}/chapters/{chapter_id}/pdf")
async def get_chapter_pdf(textbook_uuid: str, chapter_id: str):
    """Return a presigned URL to the chapter PDF stored in S3."""
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
        key = f"{S3_PREFIX}/{textbook_uuid}/{pdf_filename}"

        # Optional existence check (network call) — run in threadpool to avoid blocking the event loop
        try:
            await run_in_threadpool(lambda: s3.head_object(Bucket=S3_BUCKET, Key=key))
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code in ("404", "NotFound", "NoSuchKey"):
                logger.error(f"S3 object not found: s3://{S3_BUCKET}/{key}")
                raise HTTPException(status_code=404, detail=f"PDF file not found: {pdf_filename}")
            logger.exception("S3 head_object failed")
            raise HTTPException(status_code=500, detail="Error checking PDF in S3")

        # Generate a presigned URL so the browser can open the PDF inline
        url = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": key,
                "ResponseContentType": "application/pdf",
                "ResponseContentDisposition": f'inline; filename="{pdf_filename}"',
            },
            ExpiresIn=3600,  # seconds
        )

        return {
            "pdf_url": url,
            "chapter_title": target_chapter.get("title", f"Chapter {chapter_id}")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chapter PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving chapter PDF: {str(e)}")
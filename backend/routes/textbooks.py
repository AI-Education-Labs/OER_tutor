from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import logging
from backend.features.textbooks.models import TextbookInfo
from pydantic import BaseModel
from backend.db.database import get_document, get_document_by_field
from backend.features.auth.service import validate_access_token_optional
import boto3
import logging
from botocore.exceptions import ClientError
from starlette.concurrency import run_in_threadpool
from backend.config import settings

S3_BUCKET = settings.S3_BUCKET
S3_CLIENT_REGION = settings.S3_REGION or None
if S3_CLIENT_REGION:
    s3 = boto3.client("s3", region_name=S3_CLIENT_REGION, aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY)

class TextbookResponse(BaseModel):
    textbooks: List[TextbookInfo]
    is_authenticated: bool
    message: Optional[str] = None

router = APIRouter()
logger = logging.getLogger(__name__)

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
        is_authenticated=is_authenticated,
        message=message
    )

# TODO: These routes need to be protected
@router.get("/api/textbooks/{textbook_uuid}")
async def get_textbook_details(textbook_uuid: str):
    metadata = await get_document_by_field("textbooks", "_id", textbook_uuid)
    print(f"Textbook metadata: {metadata}")
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

@router.get("/api/textbooks/{textbook_uuid}/chapters/{chapter_id}/pdf")
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

        # Optional existence check (network call) — run in threadpool to avoid blocking the event loop
        try:
            logger.info(f"Checking S3 object existence: bucket={S3_BUCKET}, key={key}, client_region={getattr(s3.meta, 'region_name', None)}")
            await run_in_threadpool(lambda: s3.head_object(Bucket=S3_BUCKET, Key=key))
        except ClientError as e:
            response = getattr(e, "response", {}) or {}
            error_info = response.get("Error", {}) or {}
            code = str(error_info.get("Code") or "")
            message = str(error_info.get("Message") or "")
            request_id = (response.get("ResponseMetadata", {}) or {}).get("RequestId", "")
            http_headers = (response.get("ResponseMetadata", {}) or {}).get("HTTPHeaders", {}) or {}
            bucket_region = http_headers.get("x-amz-bucket-region", "")
            client_region = getattr(s3.meta, "region_name", None)

            logger.error(
                "S3 head_object failed for s3://%s/%s [code=%s message=%s request_id=%s bucket_region=%s client_region=%s]",
                S3_BUCKET,
                key,
                code,
                message,
                request_id,
                bucket_region,
                client_region,
            )

            if code in ("404", "NotFound", "NoSuchKey"):
                raise HTTPException(status_code=404, detail=f"PDF file not found: {pdf_filename}")
            if code in ("403", "AccessDenied"):
                raise HTTPException(status_code=403, detail="Access denied to the PDF file in S3")
            if code in ("NoSuchBucket",):
                raise HTTPException(status_code=404, detail=f"S3 bucket not found: {S3_BUCKET}")
            if code in ("PermanentRedirect", "AuthorizationHeaderMalformed"):
                hint_region = bucket_region or error_info.get("Region", "")
                logger.error(
                    "Likely S3 region mismatch. Bucket region=%s, client region=%s",
                    hint_region,
                    client_region,
                )
                raise HTTPException(status_code=500, detail="S3 region mismatch; check bucket region and client configuration")
            raise HTTPException(status_code=500, detail=f"Error checking PDF in S3: {code or 'UnknownError'}")

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
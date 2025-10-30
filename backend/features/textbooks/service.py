from backend.db.database import get_document_by_field
from fastapi import HTTPException
from backend.db.s3_service import get_client
from backend.config.settings import settings

async def get_textbook_metadata(textbook_id: str):
    return await get_document_by_field("textbooks", "_id", textbook_id)

async def get_textbook_chapters(textbook_id: str):
    metadata = await get_document_by_field("textbooks", "_id", textbook_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_id}")
    return metadata.get("chapters", [])

async def get_textbook_chapter_pdf(textbook_id: str, chapter_id: str):
    chapters = await get_textbook_chapters(textbook_id)

async def get_textbook_chapter_txt(textbook_id: str, chapter_id: str) -> str:
    s3 = get_client()
    response = s3.get_object(
        Bucket=settings.S3_BUCKET,
        Key=f"textbooks/{textbook_id}/chapters/{chapter_id}.txt"
    )
    print(f"Fetched TXT chapter from S3: textbook_id={textbook_id}, chapter_id={chapter_id}")
    print(response["Body"].read().decode("utf-8"))
    return response["Body"].read().decode("utf-8")
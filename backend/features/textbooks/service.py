from fastapi import HTTPException
from backend.db.models import Textbook, Chapter
from typing import List
from backend.db.s3_service import get_client
from backend.config.settings import settings

async def get_textbook_metadata(textbook_id: str):
    return await Textbook.get(textbook_id)

async def get_textbook_chapters(textbook_id: str) -> List[Chapter]:
    textbook = await Textbook.get(textbook_id)
    if textbook is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_id}")
    return textbook.chapters

async def get_textbook_chapter_pdf(textbook_id: str, chapter_id: str):
    chapters = await get_textbook_chapters(textbook_id)
    chapter = next((ch for ch in chapters if ch.id == int(chapter_id)), None)
    if chapter is None:
        raise HTTPException(status_code=404, detail=f"Chapter not found: {chapter_id} in textbook {textbook_id}")
    s3 = get_client()
    response = s3.get_object(
        Bucket=settings.S3_BUCKET,
        Key=f"textbooks/{textbook_id}/chapters/{chapter_id}.pdf"
    )
    return response["Body"].read()

async def get_textbook_chapter_txt(textbook_id: str, chapter_id: int) -> str:
    s3 = get_client()
    response = s3.get_object(
        Bucket=settings.S3_BUCKET,
        Key=f"textbooks/{textbook_id}/chapters/{chapter_id}.txt"
    )
    print(f"Fetched TXT chapter from S3: textbook_id={textbook_id}, chapter_id={chapter_id}")
    print(response["Body"].read().decode("utf-8"))
    return response["Body"].read().decode("utf-8")
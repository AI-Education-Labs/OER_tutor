from backend.db.database import get_document_by_field
from fastapi import HTTPException

async def get_textbook_metadata(textbook_id: str):
    return await get_document_by_field("textbooks", "_id", textbook_id)

async def get_textbook_chapters(textbook_id: str):
    metadata = await get_document_by_field("textbooks", "_id", textbook_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_id}")
    return metadata.get("chapters", [])

async def get_textbook_chapter_pdf(textbook_id: str, chapter_id: str):
    chapters = await get_textbook_chapters(textbook_id)

async def get_textbook_chapter_txt(textbook_id: str, chapter_id: str):
    key = f"{textbook_id}/chapter{chapter_id}.txt"
    return await get_document_by_field("textbooks", "key", key)
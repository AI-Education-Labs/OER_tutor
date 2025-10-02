from backend.db.database import get_document_by_field
from fastapi import HTTPException

PUBLIC_DIR = "./public"

async def get_chapters_from_textbook(textbook_id: str):
    metadata = await get_document_by_field("textbooks", "_id", textbook_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook_id}")
    return metadata.get("chapters", [])
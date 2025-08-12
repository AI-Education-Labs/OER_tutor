from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import json
import logging


router = APIRouter()
logger = logging.getLogger(__name__)


# Models local to this router to keep concerns isolated
class Chapter(BaseModel):
    id: int
    title: str
    sub_chapters: Optional[List[str]] = None
    file: str


class TextbookInfo(BaseModel):
    id: str
    title: str
    chapters: List[Chapter]
    filepath: str
    subject: Optional[str] = None
    created_at: Optional[datetime] = None


PUBLIC_DIR = "./public"


@router.get("/api/textbooks")
async def get_textbooks():
    """Get all available textbooks."""
    available_textbooks: List[TextbookInfo] = []

    # Local storage for textbooks, we need to switch to a database later
    TEXTBOOK_DIR = os.path.join(PUBLIC_DIR, "textbooks")

    # Temporary textbook retrieval method
    try:
        for item in os.listdir(TEXTBOOK_DIR):
            dir_path = os.path.join(TEXTBOOK_DIR, item)

            # Check if it's a directory
            if os.path.isdir(dir_path):
                metadata_path = os.path.join(dir_path, "metadata.json")

                # Check if metadata.json exists
                if os.path.isfile(metadata_path):
                    try:
                        with open(metadata_path, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                            available_textbooks.append(TextbookInfo(
                                id=metadata.get("_id"),
                                title=metadata.get("title"),
                                chapters=metadata.get("chapters"),
                                filepath=metadata.get("filepath"),
                                subject=metadata.get("subject"),
                                author=metadata.get("author"),
                                cover=metadata.get("cover"),
                                created_at=metadata.get("created_at"),
                            ))
                    except json.JSONDecodeError as e:
                        logger.error(f"Error parsing metadata.json for {item}: {str(e)}")
                    except Exception as e:
                        logger.error(f"Error reading metadata.json for {item}: {str(e)}")
                else:
                    logger.info(f"No metadata.json found for textbook directory: {item}")
    except Exception as e:
        logger.error(f"Error reading textbooks directory: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading textbooks directory: {str(e)}")

    return available_textbooks


@router.get("/api/textbooks/{textbook}")
async def get_textbook_details(textbook: str, title: Optional[str] = Query(None)):
    TEXTBOOK_DIR = os.path.join(PUBLIC_DIR, "textbooks", textbook)
    metadata_path = os.path.join(TEXTBOOK_DIR, "metadata.json")
    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)
    return metadata
    

@router.get("/api/textbooks/{textbook}/chapters")
async def get_chapters(textbook: str, title: Optional[str] = Query(None)):
    """Get available chapters for a textbook.

    Expects textbooks to be located under public/textbooks/<textbook>/metadata.json
    and returns a consistent response shape: { "chapters": [...] }.
    """
    # Ensure we look under the textbooks subdirectory
    textbook_dir = os.path.join(PUBLIC_DIR, "textbooks", textbook)

    # Normalize the slashes for Unix based systems
    print(f"Looking for chapters in: {textbook_dir}")


    # Check if the directory exists
    if not os.path.isdir(textbook_dir):
        logger.error(f"Textbook directory not found: {textbook_dir}")
        # Keep 404 for backward compatibility with previous logic
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook}")

    # Get the metadata.json file
    metadata_path = os.path.join(textbook_dir, "metadata.json")
    if not os.path.isfile(metadata_path):
        logger.error(f"Metadata file not found: {metadata_path}")
        raise HTTPException(status_code=404, detail=f"Metadata file not found: {textbook}")

    # Load the metadata.json file
    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    # Get the chapters from the metadata.json file
    chapters = metadata.get("chapters", [])
    return {"chapters": chapters}



from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from backend.redis_client import redis_client
import json

router = APIRouter()

# Models for textbook structure (not progress)
class SectionInfo(BaseModel):
    section_id: str
    section_number: str  # e.g., "1.1"
    title: str
    page_start: int
    page_end: Optional[int] = None

class ChapterInfo(BaseModel):
    chapter_id: str
    chapter_number: int
    title: str
    page_start: int
    page_end: Optional[int] = None
    sections: List[SectionInfo] = Field(default_factory=list)

class TextbookPreview(BaseModel):
    textbook_id: str
    title: str
    author: str
    total_chapters: int
    total_pages: Optional[int] = None
    cover_image_url: Optional[str] = None
    chapters: List[ChapterInfo] = Field(default_factory=list)
    # All section names for progress initialization
    all_sections: List[Dict[str, Any]] = Field(default_factory=list)

class TextbookSection(BaseModel):
    section_id: str
    content_type: str  # "pdf", "html", etc.
    content_url: Optional[str] = None
    file_data: Optional[bytes] = None

# Service functions
async def get_textbook_from_redis(textbook_id: str) -> Dict[str, Any]:
    """Get raw textbook data from Redis"""
    try:
        key = f"textbook:{textbook_id}"
        textbook_json = await redis_client.get(key)
        if not textbook_json:
            raise HTTPException(status_code=404, detail="Textbook not found")
        
        return json.loads(textbook_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid textbook data format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve textbook: {str(e)}")

async def get_section_file_from_redis(textbook_id: str, section_id: str) -> bytes:
    """Get section file content from Redis"""
    try:
        key = f"textbook_file:{textbook_id}:{section_id}"
        file_data = await redis_client.get(key)
        if not file_data:
            raise HTTPException(status_code=404, detail="Section file not found")
        
        return file_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve section file: {str(e)}")

# API Endpoints
@router.get("/get_textbook_preview/{textbook_id}", response_model=TextbookPreview)
async def get_textbook_preview(textbook_id: str):
    """
    Get textbook preview information including title, author, total chapters, 
    total pages, cover image, and names of all sections in the textbook.
    """
    try:
        # Get textbook data from Redis
        textbook_data = await get_textbook_from_redis(textbook_id)
        
        # Parse chapters and sections
        chapters = []
        all_sections = []
        
        for chapter_data in textbook_data.get("chapters", []):
            sections = []
            
            for section_data in chapter_data.get("sections", []):
                section_info = SectionInfo(
                    section_id=section_data["section_id"],
                    section_number=section_data.get("section_number", ""),
                    title=section_data["title"],
                    page_start=section_data["page_start"],
                    page_end=section_data.get("page_end")
                )
                sections.append(section_info)
                
                # Add to all_sections for progress initialization
                all_sections.append({
                    "chapter_id": chapter_data["chapter_id"],
                    "chapter_title": chapter_data["title"],
                    "section_id": section_data["section_id"],
                    "section_title": section_data["title"]
                })
            
            chapter_info = ChapterInfo(
                chapter_id=chapter_data["chapter_id"],
                chapter_number=chapter_data["chapter_number"],
                title=chapter_data["title"],
                page_start=chapter_data["page_start"],
                page_end=chapter_data.get("page_end"),
                sections=sections
            )
            chapters.append(chapter_info)
        
        # Create preview response
        preview = TextbookPreview(
            textbook_id=textbook_id,
            title=textbook_data["title"],
            author=textbook_data["author"],
            total_chapters=len(chapters),
            total_pages=textbook_data.get("total_pages"),
            cover_image_url=textbook_data.get("cover_image_url"),
            chapters=chapters,
            all_sections=all_sections
        )
        
        return preview
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get textbook preview: {str(e)}")

@router.get("/get_textbook_section/{textbook_id}/{section_id}")
async def get_textbook_section(textbook_id: str, section_id: str):
    """
    Get textbook section file (PDF, HTML, etc.) from Redis for display on webpage.
    """
    try:
        # Get section metadata to determine content type
        textbook_data = await get_textbook_from_redis(textbook_id)
        
        # Find the section to get content type
        content_type = "application/pdf"  # default
        section_found = False
        
        for chapter in textbook_data.get("chapters", []):
            for section in chapter.get("sections", []):
                if section["section_id"] == section_id:
                    content_type = section.get("content_type", "application/pdf")
                    section_found = True
                    break
            if section_found:
                break
        
        if not section_found:
            raise HTTPException(status_code=404, detail="Section not found in textbook")
        
        # Get file data from Redis
        file_data = await get_section_file_from_redis(textbook_id, section_id)
        
        # Determine media type based on content type
        media_type_map = {
            "pdf": "application/pdf",
            "html": "text/html",
            "txt": "text/plain",
            "json": "application/json"
        }
        
        media_type = media_type_map.get(content_type, "application/octet-stream")
        
        # Return file content
        return Response(
            content=file_data,
            media_type=media_type,
            headers={
                "Content-Disposition": f"inline; filename={section_id}.{content_type}",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get textbook section: {str(e)}")

# Helper function for other modules to use
async def get_textbook_structure_for_progress(textbook_id: str) -> Dict[str, Any]:
    """
    Helper function that returns textbook structure data for progress initialization.
    Used by user_progress.py to create initial progress records.
    """
    try:
        preview = await get_textbook_preview(textbook_id)
        return {
            "textbook_id": preview.textbook_id,
            "title": preview.title,
            "author": preview.author,
            "chapters": [
                {
                    "chapter_id": chapter.chapter_id,
                    "chapter_number": chapter.chapter_number,
                    "title": chapter.title,
                    "sections": [
                        {
                            "section_id": section.section_id,
                            "title": section.title
                        }
                        for section in chapter.sections
                    ]
                }
                for chapter in preview.chapters
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get textbook structure: {str(e)}")

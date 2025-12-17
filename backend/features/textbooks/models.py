from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime

class SubChapter(BaseModel):
    title: str
    pageOffset: Optional[int] = None


class Chapter(BaseModel):
    id: int
    title: str
    sub_chapters: Optional[List[SubChapter]] = None
    file: str


class Textbook(BaseModel):
    # Mongo stores the primary key as `_id`, but the API and frontend use `id`.
    # Accept Mongo's `_id` when validating, but serialize as `id` for the API/frontend.
    id: str = Field(validation_alias="_id", serialization_alias="id")
    author: Optional[str] = None
    chapters: List[Chapter]
    chapter_texts: Optional[Dict[str, str]] = None
    code: Optional[str] = None
    cover: Optional[str] = None
    created_at: Optional[datetime] = None
    subject: Optional[str] = None
    title: str

class ChapterProgress(BaseModel):
    completed: bool = False
    progress: float = 0.0  # % of the chapter completed
    time_started: Optional[datetime] = None
    time_completed: Optional[datetime] = None
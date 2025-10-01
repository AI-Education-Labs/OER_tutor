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


class TextbookInfo(BaseModel):
    id: str
    title: str
    chapters: List[Chapter]
    filepath: str
    subject: Optional[str] = None
    created_at: Optional[datetime] = None
    cover: Optional[str] = None

class ChapterProgress(BaseModel):
    completed: bool = False
    progress: float = 0.0  # % of the chapter completed
    time_started: Optional[datetime] = None
    time_completed: Optional[datetime] = None
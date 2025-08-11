from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str
    disabled: Optional[int] = 1

class UserInDB(User):
    hashed_password: str

# New models for progress tracking

class ProgressStatus(str, Enum):
    """Status of progress for any content unit"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"

class SubsectionProgress(BaseModel):
    """Progress for a specific subsection within a chapter"""
    subsection_id: str
    subsection_title: str
    status: ProgressStatus = ProgressStatus.NOT_STARTED
    completion_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    time_spent_minutes: int = Field(default=0, ge=0)
    last_accessed: Optional[datetime] = None
    notes: Optional[str] = None
    bookmarks: List[str] = Field(default_factory=list)  # Page numbers or content IDs
    
    class Config:
        use_enum_values = True

class ChapterProgress(BaseModel):
    """Progress for a specific chapter within a textbook"""
    chapter_id: str
    chapter_title: str
    chapter_number: int
    status: ProgressStatus = ProgressStatus.NOT_STARTED
    completion_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    time_spent_minutes: int = Field(default=0, ge=0)
    last_accessed: Optional[datetime] = None
    subsections: Dict[str, SubsectionProgress] = Field(default_factory=dict)
    
    # Calculated fields
    def calculate_overall_progress(self) -> float:
        """Calculate overall chapter progress based on subsections"""
        if not self.subsections:
            return self.completion_percentage
        
        total_progress = sum(sub.completion_percentage for sub in self.subsections.values())
        return total_progress / len(self.subsections) if self.subsections else 0.0
    
    def calculate_total_time(self) -> int:
        """Calculate total time spent including subsections"""
        subsection_time = sum(sub.time_spent_minutes for sub in self.subsections.values())
        return self.time_spent_minutes + subsection_time
    
    class Config:
        use_enum_values = True

class TextbookProgress(BaseModel):
    """Progress for a specific textbook"""
    textbook_id: str
    textbook_title: str
    textbook_isbn: Optional[str] = None
    status: ProgressStatus = ProgressStatus.NOT_STARTED
    completion_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    time_spent_minutes: int = Field(default=0, ge=0)
    started_date: Optional[datetime] = None
    last_accessed: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    chapters: Dict[str, ChapterProgress] = Field(default_factory=dict)
    
    # User preferences for this textbook
    current_chapter_id: Optional[str] = None
    current_subsection_id: Optional[str] = None
    reading_speed_wpm: Optional[int] = None  # Words per minute
    preferred_study_time_minutes: Optional[int] = None
    
    # Calculated fields
    def calculate_overall_progress(self) -> float:
        """Calculate overall textbook progress based on chapters"""
        if not self.chapters:
            return self.completion_percentage
        
        total_progress = sum(chapter.calculate_overall_progress() for chapter in self.chapters.values())
        return total_progress / len(self.chapters) if self.chapters else 0.0
    
    def calculate_total_time(self) -> int:
        """Calculate total time spent including all chapters and subsections"""
        chapter_time = sum(chapter.calculate_total_time() for chapter in self.chapters.values())
        return self.time_spent_minutes + chapter_time
    
    def get_next_content(self) -> Optional[Dict[str, str]]:
        """Get the next chapter/subsection to read"""
        # Logic to determine next unread content
        for chapter in self.chapters.values():
            if chapter.status != ProgressStatus.COMPLETED:
                for subsection in chapter.subsections.values():
                    if subsection.status != ProgressStatus.COMPLETED:
                        return {
                            "type": "subsection",
                            "chapter_id": chapter.chapter_id,
                            "subsection_id": subsection.subsection_id
                        }
                return {
                    "type": "chapter",
                    "chapter_id": chapter.chapter_id
                }
        return None
    
    class Config:
        use_enum_values = True

class UserProgress(BaseModel):
    """Main user progress model - this is what gets stored in Redis"""
    user_id: str
    textbook_id: str
    progress: TextbookProgress
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Study session tracking
    total_study_sessions: int = Field(default=0, ge=0)
    average_session_length_minutes: float = Field(default=0.0, ge=0.0)
    longest_session_minutes: int = Field(default=0, ge=0)
    study_streak_days: int = Field(default=0, ge=0)
    last_study_date: Optional[datetime] = None
    
    # Goals and achievements
    daily_goal_minutes: Optional[int] = None
    weekly_goal_chapters: Optional[int] = None
    achievements: List[str] = Field(default_factory=list)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Helper models for API requests

class ProgressUpdateRequest(BaseModel):
    """Request model for updating progress"""
    chapter_id: Optional[str] = None
    subsection_id: Optional[str] = None
    completion_percentage: Optional[float] = Field(None, ge=0.0, le=100.0)
    time_spent_minutes: Optional[int] = Field(None, ge=0)
    status: Optional[ProgressStatus] = None
    notes: Optional[str] = None
    bookmarks: Optional[List[str]] = None

class StudySessionRequest(BaseModel):
    """Request model for logging a study session"""
    textbook_id: str
    chapter_id: Optional[str] = None
    subsection_id: Optional[str] = None
    duration_minutes: int = Field(..., gt=0)
    pages_read: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None

class ProgressSummary(BaseModel):
    """Summary model for dashboard/overview"""
    user_id: str
    total_textbooks: int
    completed_textbooks: int
    total_chapters: int
    completed_chapters: int
    total_study_time_minutes: int
    current_streak_days: int
    achievements_count: int
    last_activity: Optional[datetime] = None

"""
Student Context Models - Per-chapter learning data

Stores comprehensive student information for each chapter to personalize tutoring.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime


class QuizAttempt(BaseModel):
    """Individual quiz attempt data"""
    quiz_id: str
    score: float  # Percentage 0-100
    total_questions: int
    correct_answers: int
    attempted_at: datetime
    missed_concepts: List[str] = []  # Concepts from incorrect answers
    time_spent_seconds: Optional[int] = None


class ConceptUnderstanding(BaseModel):
    """Track understanding level of specific concepts"""
    concept_name: str
    understanding_level: str = "unknown"  # unknown, struggling, partial, mastered
    last_discussed: Optional[datetime] = None
    times_reviewed: int = 0
    confusion_points: List[str] = []  # Specific confusions noted


class StudentChapterContext(BaseModel):
    """Complete student context for a specific chapter"""
    user_id: str
    textbook_id: str
    chapter_id: str

    # Quiz performance
    quiz_history: List[QuizAttempt] = []
    average_quiz_score: float = 0.0
    total_quizzes_taken: int = 0

    # Concept mastery (legacy - kept for backward compatibility)
    concepts_mastered: List[str] = []
    concepts_struggling: List[str] = []
    concept_details: Dict[str, ConceptUnderstanding] = {}

    # Learning plan progress (NEW)
    learning_plan_progress: Optional[Dict] = None  # LearningPlanProgress as dict

    # Chat interaction
    total_chat_messages: int = 0
    last_chat_session: Optional[str] = None
    last_chat_timestamp: Optional[datetime] = None

    # Learning metadata
    study_time_minutes: int = 0
    reading_progress_percent: int = 0
    difficulty_preference: str = "adaptive"  # adaptive, beginner, advanced
    learning_style_notes: str = ""  # LLM observations about student

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "textbook_id": "852f0488-7903-4555-bf5e-a7618f2552fd",
                "chapter_id": "1",
                "quiz_history": [
                    {
                        "quiz_id": "quiz_001",
                        "score": 75.0,
                        "total_questions": 8,
                        "correct_answers": 6,
                        "attempted_at": "2025-01-15T10:30:00",
                        "missed_concepts": ["Newton's Third Law", "Force vectors"]
                    }
                ],
                "average_quiz_score": 75.0,
                "concepts_struggling": ["Force vectors"],
                "concepts_mastered": ["Newton's First Law"],
                "difficulty_preference": "adaptive"
            }
        }

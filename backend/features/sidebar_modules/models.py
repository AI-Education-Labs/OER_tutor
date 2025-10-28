from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List

# Flashcard Models

class FlashcardDeck(BaseModel):
    flashcards_front: List[str] = Field(description="A list of keywords, terms, or condensed concepts, the front of the flashcard")
    flashcards_back: List[str] = Field(description="A list of defintions, explanations, answers, the back of the flashcard")

class FlashcardRequest(BaseModel):
    context: str
    textbook_id: str
    chapter: str
    num_flashcards: int = 5
    hint: Optional[str] = None

# Study Guide Models

class StudyGuide(BaseModel):
    study_guide: str = Field(description="A study guide for the student to review their material")

class StudyGuideRequest(BaseModel):
    context: str
    textbook_id: str
    chapter: str
    hint: Optional[str] = None
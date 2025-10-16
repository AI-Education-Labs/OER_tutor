from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List

# Quiz Models

class QuizQuestion(BaseModel):
    question: str = Field(description="The question to be answered")
    choices: List[str] = Field(description="Four multiple choice options for the question")
    answer: int = Field(description="The index of the correct answer (0th index is the first option)")

class GeneratedQuiz(BaseModel):
    questions: List[QuizQuestion] = Field(description="A list of quiz questions")

class QuizRequest(BaseModel):
    context: str
    textbook_id: str
    chapter: str
    num_questions: int = 5
    hint: Optional[str] = None

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
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any

class QuizResultUpdate(BaseModel):
    quiz_result: Dict[str, Any]

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

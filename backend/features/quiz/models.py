from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
class QuizQuestion(BaseModel):
    question: str = Field(description="The question to be answered")
    choices: List[str] = Field(description="Four multiple choice options for the question")
    answer: int = Field(description="The index of the correct answer (0th index is the first option)")

class QuizItem(BaseModel):
    id: str = Field(description="Unique identifier for the quiz")
    user: str = Field(description="ID of the user who owns the quiz")
    quiz: List[QuizQuestion] = Field(description="Quiz questions list")
    created_time: int = Field(description="Timestamp when the quiz was created")
    hint: Optional[str] = Field(description="Optional hint or section focus for the quiz")
    quiz_result: Dict[str, Any] = Field(description="Results of the quiz taken by the user")

class GenerateRequest(BaseModel):
    context: str = Field(description="The context from the textbook chapter to generate the quiz from")
    textbook_id: str = Field(description="The ID of the textbook")
    chapter: int = Field(description="The chapter of the textbook to generate the quiz for")
    num_questions: int = Field(description="The number of questions to generate for the quiz", default=5)

# JSON format for gpt to return, aswell as used for response model
class GeneratedQuiz(BaseModel):
    questions: List[QuizQuestion] = Field(description="A list of quiz questions")
class DeleteResponse(BaseModel):
    ok: bool = Field(description="Indicates if the deletion was successful")

class QuizResultUpdate(BaseModel):
    quiz_result: Dict[str, Any] = Field(description="The results of the quiz to be updated")

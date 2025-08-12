from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from openai import OpenAI
from backend.config import settings
import os

router = APIRouter()


def get_openai_client() -> OpenAI:
    api_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
    print("api_key:", api_key)
    try:
        if api_key:
            return OpenAI(api_key=api_key)
        return OpenAI()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OpenAI client init failed: {exc}")

@router.get("/health")
async def health() -> dict:
    return {"ok": True}


@router.post("/query_llm")
async def query_llm(query: str, model: str = "gpt-4.1", system_prompt: str = None):
    # Lazily initialize the client per request to avoid import-time failures
    client = get_openai_client()

    conversation_context = []
    if system_prompt:
        conversation_context.append({"role": "developer", "content": system_prompt})
    if query:
        conversation_context.append({"role": "user", "content": query})
    
    response = client.responses.create(
        model=model,
        input=conversation_context
    )

    return response.output_text


# We'll create seperate functions for core features for now, improve scalability later

class QuizQuestion(BaseModel):
    question: str = Field(description="The question to be answered")
    choices: List[str] = Field(description="Four multiple choice options for the question")
    answer: int = Field(description="The index of the correct answer (0th index is the first option)")

class GeneratedQuiz(BaseModel):
    questions: List[QuizQuestion] = Field(description="A list of quiz questions")

class QuizRequest(BaseModel):
    context: str
    num_questions: int = 5
    hint: Optional[str] = None


@router.post("/api/quiz/generate")
async def generate_quiz(body: QuizRequest):
    context = body.context
    num_questions = body.num_questions
    hint = body.hint
    print("context:", context)
    client = get_openai_client()

    system_prompt = f"You are a helpful tutor for a student currently studying a textbook. Help create a formatted quiz for the student. Each question should be a multiple choice question with four options and one correct answer. The options should be realistic but clearly wrong to someone who understands the material.Generate a multiple choice quiz with {num_questions} questions based on the following context: {context}"

    if hint:
        system_prompt += f"\nFocus only on this section/topic if applicable: {hint}"

    try:
        response = client.responses.parse(
            model="gpt-4.1",
            input=[
                {"role": "developer", "content": system_prompt},
                {"role": "user", "content": "Generate a quiz"}
            ],
            text_format=GeneratedQuiz
        )

        data = response.output[0].content[0].parsed

        quiz_list = []
        for i, question in enumerate(data.questions):
            quiz_list.append({
                "question": question.question,
                "choices": question.choices,
                "answer": question.answer
            })
        print("QUIZ:", quiz_list)

    except Exception as e:
        print("error:", e)
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {e}")

    return quiz_list
    
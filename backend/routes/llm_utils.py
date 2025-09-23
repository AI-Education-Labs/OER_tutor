from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from openai import OpenAI
from backend.config import settings
from backend.utils.textextract import text_extract_with_save
import os

router = APIRouter()


def get_openai_client() -> OpenAI:
    api_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
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
    textbook_id: str
    chapter: str
    num_questions: int = 5
    hint: Optional[str] = None


@router.post("/api/quiz/generate")
async def generate_quiz(body: QuizRequest):
    context = body.context
    textbook_id = body.textbook_id
    chapter = body.chapter
    num_questions = body.num_questions
    hint = body.hint
    print("context:", context)
    client = get_openai_client()

    system_prompt = f"You are a helpful tutor for a student currently studying a textbook. Help create a formatted quiz for the student. Each question should be a multiple choice question with four options and one correct answer. The options should be realistic but clearly wrong to someone who understands the material. Generate a multiple choice quiz with {num_questions} questions based on the following their current chapter: "

    chapter_path = "public/textbooks/" + textbook_id + "/chapter" + chapter

    # Get the text from the chapter
    chapter_text = ""
    if os.path.exists(chapter_path + ".txt"):
        with open(chapter_path + ".txt", "r", encoding="utf-8", errors="replace") as file:
            chapter_text = file.read()
    else:
        chapter_text = text_extract_with_save(chapter_path + ".pdf")

    if(chapter_text == ""):
        raise HTTPException(status_code=500, detail="Error extracting text from chapter")
    else:
        system_prompt += f"{context}"

    if hint:
        system_prompt += f"[End of Chapter]\nMake sure you are only working on the current section: {hint}"

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
    

# We'll create seperate functions for core features for now, improve scalability later

class FlashcardDeck(BaseModel):
    flashcards_front: List[str] = Field(description="A list of keywords, terms, or condensed concepts, the front of the flashcard")
    flashcards_back: List[str] = Field(description="A list of defintions, explanations, answers, the back of the flashcard")

class FlashcardRequest(BaseModel):
    context: str
    textbook_id: str
    chapter: str
    num_flashcards: int = 5
    hint: Optional[str] = None


@router.post("/api/flashcard/generate")
async def generate_flashcard(body: FlashcardRequest):
    context = body.context
    textbook_id = body.textbook_id
    chapter = body.chapter
    num_flashcards = body.num_flashcards
    hint = body.hint
    print("chapter:", chapter)
    client = get_openai_client()

    system_prompt = f"You are a helpful tutor for a student currently studying a textbook. Help create a deck of flashcards quiz for the student. You will represent the flashcard deck in two arrays of equal size, one representing the front sides of the flashcards and one representing the backside of the flashcard. Use the flashcards to help the student learn and understand keywords, terms, and condensed concepts. Be sure to keep the order for the front and the back of the flashcard arrays respective of each other, e.g. Index 1 of the front array should correspond to the answer of Index 1 of the back array. Generate a deck of flashcards with {num_flashcards} flashcards based on the current chapter: "

    chapter_path = "public/textbooks/" + textbook_id + "/chapter" + chapter 

    # Get the text from the chapter
    chapter_text = ""
    if os.path.exists(chapter_path + ".txt"):
        with open(chapter_path + ".txt", "r", encoding="utf-8", errors="replace") as file:
            chapter_text = file.read()
    else:
        chapter_text = text_extract_with_save(chapter_path + ".pdf")

    print("chapter_text:", chapter_text)

    if(chapter_text == ""):
        raise HTTPException(status_code=500, detail="Error extracting text from chapter")
    else:
        system_prompt += f"{context}"

    if hint:
        system_prompt += f"[End of Chapter]\nFocus only on this section/topic if applicable: {hint}"

    try:
        response = client.responses.parse(
            model="gpt-4.1",
            input=[
                {"role": "developer", "content": system_prompt},
                {"role": "user", "content": "Generate a flashcard deck"}
            ],
            text_format=FlashcardDeck
        )

        data = response.output[0].content[0].parsed

    except Exception as e:
        print("error:", e)
        raise HTTPException(status_code=500, detail=f"Error generating flashcard deck: {e}")

    print("FLASHCARD DECK:", data)
    return data
    
# We'll create seperate functions for core features for now, improve scalability later

class StudyGuide(BaseModel):
    study_guide: str = Field(description="A study guide for the student to review their material")

class StudyGuideRequest(BaseModel):
    context: str
    hint: Optional[str] = None


@router.post("/api/key-concept/generate")
async def generate_study_guide(body: StudyGuideRequest):
    context = body.context
    hint = body.hint
    print("context:", context)
    client = get_openai_client()

    system_prompt = f"You job it to help a student create a study guide based on the current context: {context} [END OF CONTEXT], what they have learned so far so that they can effectively review their material. Your task is to create condensed notes, summarized into bullet poinst and shorter sentences while highlighing key terms, equations, or bold concepts. Be sure to include example problems with step-by-step solutions. Be sure to utilize formatting to make the content engaging such as bolding key words, italizing examples and using heading and bullet points to prevent cognitive overload."

    if hint:
        system_prompt += f"\nFocus only on this section/topic if applicable: {hint}"

    try:
        response = client.responses.parse(
            model="gpt-4.1",
            input=[
                {"role": "developer", "content": system_prompt},
                {"role": "user", "content": "Generate a study guide"}
            ],
            text_format=StudyGuide
        )

        data = response.output[0].content[0].parsed

    except Exception as e:
        print("error:", e)
        raise HTTPException(status_code=500, detail=f"Error generating study guide: {e}")

    print("STUDY GUIDE:", data)
    return data.study_guide
    
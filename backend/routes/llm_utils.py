from fastapi import APIRouter, HTTPException, Depends, status
from openai import OpenAI
from backend.config import settings
from backend.routes.textbooks import get_chapter_text
from backend.features.sidebar_modules.models import *
from backend.db.database import get_collection
from backend.features.auth.service import validate_access_token
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import uuid, time

router = APIRouter()


def get_openai_client() -> OpenAI:
    api_key = settings.OPENAI_API_KEY
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

@router.post("/api/quiz/generate")
async def generate_quiz(body: QuizRequest, current_user = Depends(validate_access_token)):
    context = body.context
    textbook_id = body.textbook_id
    chapter = body.chapter
    num_questions = body.num_questions
    hint = body.hint
    print("context:", context)
    client = get_openai_client()

    system_prompt = f"You are a helpful tutor for a student currently studying a textbook. Help create a formatted quiz for the student. Each question should be a multiple choice question with four options and one correct answer. The options should be realistic but clearly wrong to someone who understands the material. Generate a multiple choice quiz with {num_questions} questions based on the following their current chapter: "

    # Get the text from the chapter stored in S3 via shared helper
    chapter_text = ""
    try:
        chapter_text = await get_chapter_text(textbook_id, chapter)
    except HTTPException as e:
        raise e
    except Exception:
        chapter_text = ""

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

        # Persist quiz for the user
        try:
            user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
            quizzes = await get_collection("user_quizzes")
            doc = {
                "_id": str(uuid.uuid4()),
                "user": user_id,
                "quiz": quiz_list,
                "created_time": int(time.time()),
                "hint": hint,
                "quiz_result": {},
                "textbook_id": textbook_id,
                "chapter": chapter,
            }
            await quizzes.insert_one(doc)
        except Exception as persist_exc:
            # Do not fail the request if persistence fails; log to stdout for now
            print(f"Failed to persist quiz: {persist_exc}")

    except Exception as e:
        print("error:", e)
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {e}")

    return quiz_list

@router.post("/api/flashcard/generate")
async def generate_flashcard(body: FlashcardRequest, current_user = Depends(validate_access_token)):
    context = body.context
    textbook_id = body.textbook_id
    chapter = body.chapter
    num_flashcards = body.num_flashcards
    hint = body.hint
    print("chapter:", chapter)
    client = get_openai_client()

    system_prompt = f"You are a helpful tutor for a student currently studying a textbook. Help create a deck of flashcards quiz for the student. You will represent the flashcard deck in two arrays of equal size, one representing the front sides of the flashcards and one representing the backside of the flashcard. Use the flashcards to help the student learn and understand keywords, terms, and condensed concepts. Be sure to keep the order for the front and the back of the flashcard arrays respective of each other, e.g. Index 1 of the front array should correspond to the answer of Index 1 of the back array. Generate a deck of flashcards with {num_flashcards} flashcards based on the current chapter: "

    # Get the text from the chapter stored in S3 via shared helper
    chapter_text = ""
    try:
        chapter_text = await get_chapter_text(textbook_id, chapter)
    except HTTPException as e:
        raise e
    except Exception:
        chapter_text = ""

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

    # Persist flashcards for the user
    try:
        user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
        flashcards_col = await get_collection("user_flashcards")
        doc = {
            "_id": str(uuid.uuid4()),
            "user": user_id,
            "flashcard": data.model_dump(),
            "created_time": int(time.time()),
            "hint": hint,
            "textbook_id": textbook_id,
            "chapter": chapter,
        }
        await flashcards_col.insert_one(doc)
    except Exception as persist_exc:
        print(f"Failed to persist flashcards: {persist_exc}")
    return data

@router.post("/api/key-concept/generate")
async def generate_study_guide(body: StudyGuideRequest, current_user = Depends(validate_access_token)):
    context = body.context
    hint = body.hint
    textbook_id = body.textbook_id
    chapter = body.chapter
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

    # Persist study guide as a note for the user
    try:
        user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
        notes_col = await get_collection("user_notes")
        doc = {
            "_id": str(uuid.uuid4()),
            "user": user_id,
            "study_guide": data.study_guide,
            "created_time": int(time.time()),
            "hint": hint,
            "textbook_id": textbook_id,
            "chapter": chapter,
        }
        await notes_col.insert_one(doc)
    except Exception as persist_exc:
        print(f"Failed to persist study guide: {persist_exc}")
    return data.study_guide


# -----------------------
# Fetch and update routes
# -----------------------

class QuizResultUpdate(BaseModel):
    quiz_result: Dict[str, Any]


@router.get("/api/quizzes", status_code=status.HTTP_200_OK)
async def list_user_quizzes(current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    try:
        cursor = collection.find({"user": user_id}).sort("created_time", -1)
        quizzes: List[Dict[str, Any]] = [doc async for doc in cursor]
        return quizzes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching quizzes: {e}")


@router.get("/api/quizzes/{item_id}", status_code=status.HTTP_200_OK)
async def get_user_quiz(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    doc = await collection.find_one({"_id": item_id, "user": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return doc


@router.patch("/api/quizzes/{item_id}/result", status_code=status.HTTP_200_OK)
async def update_quiz_result(item_id: str, payload: QuizResultUpdate, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    result = await collection.update_one(
        {"_id": item_id, "user": user_id},
        {"$set": {"quiz_result": payload.quiz_result}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")
    updated = await collection.find_one({"_id": item_id, "user": user_id})
    return updated


@router.delete("/api/quizzes/{item_id}", status_code=status.HTTP_200_OK)
async def delete_user_quiz(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    result = await collection.delete_one({"_id": item_id, "user": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"ok": True}


@router.get("/api/flashcards", status_code=status.HTTP_200_OK)
async def list_user_flashcards(current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    try:
        cursor = collection.find({"user": user_id}).sort("created_time", -1)
        cards: List[Dict[str, Any]] = [doc async for doc in cursor]
        return cards
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching flashcards: {e}")


@router.get("/api/flashcards/{item_id}", status_code=status.HTTP_200_OK)
async def get_user_flashcard(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    doc = await collection.find_one({"_id": item_id, "user": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Flashcard deck not found")
    return doc


@router.delete("/api/flashcards/{item_id}", status_code=status.HTTP_200_OK)
async def delete_user_flashcard(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    result = await collection.delete_one({"_id": item_id, "user": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flashcard deck not found")
    return {"ok": True}


@router.get("/api/notes", status_code=status.HTTP_200_OK)
async def list_user_notes(current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_notes")
    try:
        cursor = collection.find({"user": user_id}).sort("created_time", -1)
        notes: List[Dict[str, Any]] = [doc async for doc in cursor]
        return notes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notes: {e}")


@router.get("/api/notes/{item_id}", status_code=status.HTTP_200_OK)
async def get_user_note(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_notes")
    doc = await collection.find_one({"_id": item_id, "user": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Note not found")
    return doc


@router.delete("/api/notes/{item_id}", status_code=status.HTTP_200_OK)
async def delete_user_note(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_notes")
    result = await collection.delete_one({"_id": item_id, "user": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}
    
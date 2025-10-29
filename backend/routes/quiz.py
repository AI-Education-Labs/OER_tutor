from fastapi import APIRouter, Depends, HTTPException, status
from backend.features.quiz.models import *
from backend.routes.auth import validate_cookie_token
from backend.db.database import get_collection
from backend.routes.textbooks import get_chapter_text
from typing import Optional, Dict, List, Any
import uuid
import time

router = APIRouter()



# Quiz Models
from backend.config.settings import settings
from openai import OpenAI


# TODO:abstract this to shared utils
def get_openai_client() -> OpenAI:
    api_key = settings.OPENAI_API_KEY
    try:
        if api_key:
            return OpenAI(api_key=api_key)
        return OpenAI()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OpenAI client init failed: {exc}")



@router.post("/generate", response_model=GeneratedQuiz)
async def generate_quiz(body: GenerateRequest, current_user = Depends(validate_cookie_token)):
    """
    Generate quiz from textbook chapter context using LLM.

    Request Body:
    - context: The context from the textbook chapter to generate the quiz from
    - textbook_id: The ID of the textbook
    - chapter: The chapter of the textbook to generate the quiz for
    - num_questions: The number of questions to generate for the quiz
    - hint: Optional hint or section focus for the quiz
    """
    context = body.context # TODO: Frontend should be untrusted for the content of the book, injectable
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
        response = client.beta.chat.completions.parse(
            model="gpt-4.1",
            messages=[
                {"role": "developer", "content": system_prompt},
                {"role": "user", "content": "Generate a quiz"}
            ],
            response_format=GeneratedQuiz
        )

        data = response.choices[0].message.parsed

        if not data:
            raise HTTPException(status_code=500, detail="Failed to parse quiz data from OpenAI response")
        quiz_list: GeneratedQuiz = data
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


# TODO: this could get scoped down to the specific book they are working on
@router.get("/list", status_code=status.HTTP_200_OK, response_model=List[QuizItem])
async def list_user_quizzes(current_user = Depends(validate_cookie_token)):
    """
    List all quizzes for the current user.

    user is obtained from the validated cookie token.
    """
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    try:
        cursor = collection.find({"user": user_id}).sort("created_time", -1)
        quizzes: List[Dict[str, Any]] = [doc async for doc in cursor]
        return quizzes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching quizzes: {e}")


@router.get("/{item_id}", status_code=status.HTTP_200_OK, response_model=QuizItem)
async def get_user_quiz(item_id: str, current_user = Depends(validate_cookie_token)):
    """
    Get a specific quiz for the current user by id.
    """
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    doc = await collection.find_one({"_id": item_id, "user": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return doc


@router.delete("/{item_id}", status_code=status.HTTP_200_OK, response_model=DeleteResponse)
async def delete_user_quiz(item_id: str, current_user = Depends(validate_cookie_token)):
    """
    Delete a specific quiz for the current user.
    """
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    result = await collection.delete_one({"_id": item_id, "user": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"ok": True}


#TODO: currently not used in frontend, Implement there and retype here
@router.patch("/{item_id}/result", status_code=status.HTTP_200_OK)
async def update_quiz_result(item_id: str, payload: QuizResultUpdate, current_user = Depends(validate_cookie_token)):
    """
    Update the quiz result for a specific quiz for the current user.

    CURRENT IMPLEMENTATION DOESN'T EXIST IN FRONTEND YET! BACKEND QUESTIONABLE
    """
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

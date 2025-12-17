from fastapi import APIRouter, HTTPException, Depends, status
from backend.features.textbooks.service import get_chapter_text
from backend.features.sidebar_modules.models import *
from backend.db.database import get_collection
from backend.features.auth.service import validate_access_token
from backend.features.openai.service import generate_with_responses_parse
from pydantic import BaseModel
from typing import Any, Dict, List
import uuid, time

router = APIRouter()



@router.post("/generate")
async def generate_quiz(body: QuizRequest, current_user = Depends(validate_access_token)):
    context = body.context
    textbook_id = body.textbook_id
    chapter = body.chapter
    num_questions = body.num_questions
    hint = body.hint
    print("context:", context)
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)

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
        response = generate_with_responses_parse(
            model="gpt-4.1",
            messages=[
                {"role": "developer", "content": system_prompt},
                {"role": "user", "content": "Generate a quiz"}
            ],
            response_format=GeneratedQuiz,
            user_id=user_id,
            trace_name="quiz-generation",
            metadata={
                "textbook_id": textbook_id,
                "chapter": chapter,
                "num_questions": str(num_questions),
                "hint": hint
            }
        )

        data = response.choices[0].message.parsed

        if not data:
            raise HTTPException(status_code=500, detail="Failed to parse quiz response")

        quiz_list = []
        for question in data.questions:
            quiz_list.append({
                "question": question.question,
                "choices": question.choices,
                "answer": question.answer
            })
        print("QUIZ:", quiz_list)

        # Persist quiz for the user
        try:
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


class QuizResultUpdate(BaseModel):
    quiz_result: Dict[str, Any]


@router.get("/list", status_code=status.HTTP_200_OK)
async def list_user_quizzes(current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    try:
        cursor = collection.find({"user": user_id}).sort("created_time", -1)
        quizzes: List[Dict[str, Any]] = [doc async for doc in cursor]
        return quizzes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching quizzes: {e}")


@router.get("/{item_id}", status_code=status.HTTP_200_OK)
async def get_user_quiz(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    doc = await collection.find_one({"_id": item_id, "user": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return doc


@router.patch("/{item_id}/result", status_code=status.HTTP_200_OK)
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


@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
async def delete_user_quiz(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_quizzes")
    result = await collection.delete_one({"_id": item_id, "user": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"ok": True}

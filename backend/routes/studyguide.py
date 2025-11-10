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


@router.post("/generate")
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


@router.get("/{item_id}", status_code=status.HTTP_200_OK)
async def get_user_note(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_notes")
    doc = await collection.find_one({"_id": item_id, "user": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Note not found")
    return doc


@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
async def delete_user_note(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_notes")
    result = await collection.delete_one({"_id": item_id, "user": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}

# TODO: shouldn't there be a get study-guides list endpoint?

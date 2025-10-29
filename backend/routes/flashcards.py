import time
from fastapi import APIRouter, Depends, HTTPException, status
from backend.features.auth.service import validate_cookie_token
from backend.db.database import get_collection
from typing import Any, Dict, List
from backend.features.flashcards.models import FlashcardRequest, FlashcardDeck
from backend.config import settings
from backend.routes.textbooks import get_chapter_text
import uuid

router = APIRouter()

from openai import OpenAI


# TODO:DEV abstract this to a shared utility
def get_openai_client() -> OpenAI:
    api_key = settings.OPENAI_API_KEY
    try:
        if api_key:
            return OpenAI(api_key=api_key)
        return OpenAI()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OpenAI client init failed: {exc}")


@router.get("/list", status_code=status.HTTP_200_OK)
async def list_user_flashcards(current_user = Depends(validate_cookie_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    try:
        cursor = collection.find({"user": user_id}).sort("created_time", -1)
        cards: List[Dict[str, Any]] = [doc async for doc in cursor]
        return cards
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching flashcards: {e}")


@router.get("/{item_id}", status_code=status.HTTP_200_OK)
async def get_user_flashcard(item_id: str, current_user = Depends(validate_cookie_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    doc = await collection.find_one({"_id": item_id, "user": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Flashcard deck not found")
    return doc


@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
async def delete_user_flashcard(item_id: str, current_user = Depends(validate_cookie_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    result = await collection.delete_one({"_id": item_id, "user": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flashcard deck not found")
    return {"ok": True}


@router.post("/generate")
async def generate_flashcard(body: FlashcardRequest, current_user = Depends(validate_cookie_token)):
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

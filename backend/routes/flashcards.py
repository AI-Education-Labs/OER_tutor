from fastapi import APIRouter, HTTPException, Depends, status
from backend.routes.textbooks import get_chapter_text
from backend.features.sidebar_modules.models import *
from backend.db.database import get_collection
from backend.features.auth.service import validate_access_token
from backend.features.openai.service import generate_with_responses_parse
from typing import Any, Dict, List
import uuid, time

router = APIRouter()


@router.post("/generate")
async def generate_flashcard(body: FlashcardRequest, current_user = Depends(validate_access_token)):
    textbook_id = body.textbook_id
    chapter = body.chapter
    num_flashcards = body.num_flashcards
    hint = body.hint
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    developer_prompt=  """
    You are an expert tutor who creates effective flashcards for students studying textbooks.

Your task is to generate flashcard decks that help students learn keywords, terms, and core concepts.

Output format:
- Return valid JSON with two arrays: "fronts" and "backs"
- Each index in "fronts" must correspond to the same index in "backs"
- Generate the requested number of flashcards

Flashcard best practices:
- Keep questions clear and concise
- Avoid yes/no questions
- Include enough context without revealing the answer
- Focus on testable knowledge and understanding"""

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
    try:
        response = generate_with_responses_parse(
            model="gpt-4.1",
            messages=[
                {"role": "developer", "content": developer_prompt },
                {"role": "user", "content": f"Create {num_flashcards} flashcards.\nFocus on only this section/topic if applicable: {hint}\n from this chapter: \n\n {chapter_text}"}
            ],
            response_format=FlashcardDeck,
            user_id=user_id,
            trace_name="flashcard-generation",
            metadata={
                "textbook_id": textbook_id,
                "chapter": chapter,
                "num_flashcards": str(num_flashcards),
                "hint": hint
            }
        )

        data = response.choices[0].message.parsed

        if not data:
            raise HTTPException(status_code=500, detail="Failed to parse flashcard response")
        
        # Trim the deck to the requested number of flashcards as a safeguard
        if len(data.flashcards_front) > num_flashcards:
            data.flashcards_front = data.flashcards_front[:num_flashcards]
            data.flashcards_back = data.flashcards_back[:num_flashcards]

    except Exception as e:
        print("error:", e)
        raise HTTPException(status_code=500, detail=f"Error generating flashcard deck: {e}")

    # Persist flashcards for the user
    try:
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


@router.get("/list", status_code=status.HTTP_200_OK)
async def list_user_flashcards(current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    try:
        cursor = collection.find({"user": user_id}).sort("created_time", -1)
        cards: List[Dict[str, Any]] = [doc async for doc in cursor]
        return cards
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching flashcards: {e}")


@router.get("/{item_id}", status_code=status.HTTP_200_OK)
async def get_user_flashcard(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    doc = await collection.find_one({"_id": item_id, "user": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Flashcard deck not found")
    return doc


@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
async def delete_user_flashcard(item_id: str, current_user = Depends(validate_access_token)):
    user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
    collection = await get_collection("user_flashcards")
    result = await collection.delete_one({"_id": item_id, "user": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flashcard deck not found")
    return {"ok": True}

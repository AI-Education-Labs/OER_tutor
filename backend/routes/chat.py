import json
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request, BackgroundTasks, HTTPException
from sse_starlette.sse import EventSourceResponse

from backend.features.auth.service import validate_access_token
from backend.features.chat.service import ChatService

router = APIRouter()
logger = logging.getLogger(__name__)

def get_chat_service() -> ChatService:
    return ChatService()

@router.post("/update-summary-async")
async def update_summary_async(
    request: Request,
    user_id: str = Depends(validate_access_token),
    service: ChatService = Depends(get_chat_service)
):
    """
    Standalone endpoint to update conversation summary.
    Called fire-and-forget from streaming endpoint.
    """
    try:
        data = await request.json()
        session_id = data.get("session_id")

        if not session_id:
            logger.warning("update-summary-async called without session_id")
            return {"status": "error", "message": "session_id required"}

        logger.info(f"Starting async summary update for session {session_id}")
        await service.update_conversation_summary(user_id, session_id)
        logger.info(f"Completed async summary update for session {session_id}")

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error in update-summary-async: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/message")
async def chat_message(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(validate_access_token),
    service: ChatService = Depends(get_chat_service)
):
    data = await request.json()
    user_message = data.get("message")
    session_id = data.get("session_id") or str(uuid.uuid4())
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    ai_response = await service.chat_message(user_id, session_id, user_message)

    return {"session_id": session_id, "ai_response": ai_response}

@router.post("/stream")
async def stream_chat(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(validate_access_token),
    service: ChatService = Depends(get_chat_service)
):
    data = await request.json()
    user_message = data.get("message")
    textbook_id = data.get("textbook_id")
    chapter_id = data.get("chapter_id")
    session_id = data.get("session_id")

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if not session_id:
        session_id = str(uuid.uuid4())
        logger.info(f"Generated new session ID: {session_id}")

    return EventSourceResponse(
        service.stream_chat(user_id, session_id, user_message, textbook_id, chapter_id)
    )

@router.get("/history")
async def get_chat_history(
    session_id: Optional[str] = None,
    user_id: str = Depends(validate_access_token),
    service: ChatService = Depends(get_chat_service)
):
    try:
        return await service.get_chat_history(user_id, session_id)
    except Exception as e:
        logger.error(f"Error in get_chat_history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chat history")

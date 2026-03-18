import json
import uuid
from datetime import datetime, date, timezone
from typing import Optional, AsyncGenerator

import logging
from pydantic import BaseModel

from fastapi import APIRouter, Depends, Request, BackgroundTasks, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from openai.types.chat import ChatCompletionMessageParam
from backend.features.openai.service import (
    generate_chat_completion,
    generate_chat_completion_stream,
    generate_structured_chat_completion,
    track_stream_completion
)
from backend.features.openai.prompts import chat_prompt
from backend.db.database import get_collection
from backend.features.users.models import User
from backend.features.auth.service import validate_access_token
from backend.features.textbooks.service import get_chapter_text


router = APIRouter()

# Logger setup
logger = logging.getLogger(__name__)


# ----------------------------
# Mongo Chat Message History
# ----------------------------
class MongoChatMessageHistory:
    def __init__(self, session_id: str, collection_name: str = "chat_messages"):
        self.session_id = session_id
        self.collection_name = collection_name


    async def add_message(self, role: str, content: str) -> None:
        collection = await get_collection(self.collection_name)
        await collection.insert_one({
            "session_id": self.session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc)
        })


    async def get_messages(self, limit: int = 50):
        collection = await get_collection(self.collection_name)
        cursor = collection.find({"session_id": self.session_id}).sort("timestamp", -1).limit(limit)
        messages = await cursor.to_list(length=limit)
        messages.sort(key=lambda m: m["timestamp"])
        return messages




# ----------------------------
# Conversation Summary / Title
# ----------------------------
class ImportantMessage(BaseModel):
    role: str
    content: str

class ConversationSummary(BaseModel):
    title: str
    summary: str
    important_messages: list[ImportantMessage]

async def update_conversation_summary(user_id: str, session_id: str):
    try:
        history = MongoChatMessageHistory(session_id=session_id)
        messages = await history.get_messages(limit=10)

        important_messages_collection = MongoChatMessageHistory(session_id=session_id, collection_name="important_messages")
        important_messages = await important_messages_collection.get_messages(limit=20)

        # Build message history for OpenAI
        llm_msgs: list[ChatCompletionMessageParam] = []

        # Add system message
        llm_msgs.append({
            "role": "system",
            "content": "Update the conversation summary with new information, and decide if the recent messages need to be added to important messages."
        })

        # Track important message identifiers to avoid duplication
        important_msg_ids = set()

        # Add important messages
        if important_messages:
            llm_msgs.append({
                "role": "system",
                "content": "Important messages from the conversation:"
            })
            for msg in important_messages:
                if msg["role"] in ["user", "assistant"]:
                    llm_msgs.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
                    # Track this message to avoid duplication
                    msg_id = (msg["role"], msg["content"], str(msg.get("timestamp", "")))
                    important_msg_ids.add(msg_id)

        # Add recent messages (excluding duplicates already in important messages)
        llm_msgs.append({
            "role": "system",
            "content": "Recent messages:"
        })
        for msg in messages:
            if msg["role"] in ["user", "assistant"]:
                msg_id = (msg["role"], msg["content"], str(msg.get("timestamp", "")))
                if msg_id not in important_msg_ids:
                    llm_msgs.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })

        # Get existing summary and title
        collection = await get_collection("conversation_summaries")
        existing_doc = await collection.find_one({"session_id": session_id, "user_id": user_id})
        existing_title = existing_doc.get("title") if existing_doc else None
        existing_summary = existing_doc.get("summary") if existing_doc else None

        # Add final instruction as a user message
        llm_msgs.append({
            "role": "user",
            "content": f"""You are an assistant that UPDATES conversation summaries and finds important messages.

EXISTING TITLE: {existing_title or "None - create a simple 2-4 word title"}
EXISTING SUMMARY: {existing_summary or "None - create initial summary"}

Instructions:
- "title": If existing title is good and still fits the conversation, KEEP IT EXACTLY THE SAME. Only change if conversation topic has significantly shifted. Keep it very simple: 2-4 words (e.g., "Psychology Methods", "Chapter Discussion"). DO NOT add unnecessary details like dates or chapter numbers unless critical.

- "summary": If existing summary exists, UPDATE it by ADDING new information. DO NOT replace the entire summary - build upon it. Format: "Previous topics: [old info]. New discussion: [new info]". Keep it concise but comprehensive.

- "important_messages": a list of truly important messages (same guidelines as before) no duplicates from existing important messages. Only add messages that contain ESSENTIAL information, instructions, or insights. DO NOT include greetings, filler, or procedural messages.

Guidelines for "important_messages":
1. Only include messages with essential information or insights
2. Exclude greetings, filler, procedural messages
3. Include detailed instructions/plans verbatim as single messages
4. Do not split long messages
5. Empty list if no important messages
6. Do not duplicate messages already in the conversation"""
        })

        # Use structured output with Pydantic model
        completion = generate_structured_chat_completion(
            trace_name="update_conversation_summary",
            model="gpt-4o-mini",
            messages=llm_msgs,
            response_format=ConversationSummary,
            user_id=user_id,
            temperature=0,
            session_id=session_id,
            metadata={"session_id": session_id}
        )

        result = completion.choices[0].message.parsed

        if result is None:
            logger.error("OpenAI structured output parsing returned None")
            new_title = existing_title or "Chat Session"
            new_summary = existing_summary or ""
        else:
            new_title = result.title
            new_summary = result.summary
            important_msgs = result.important_messages

            # Add important messages to collection
            if important_msgs:
                for msg in important_msgs:
                    await important_messages_collection.add_message(msg.role, msg.content)

        await collection.update_one(
            {"session_id": session_id, "user_id": user_id},
            {"$set": {"title": new_title, "summary": new_summary, "updated_at": datetime.now(timezone.utc)}},
            upsert=True
        )
    except Exception as e:
        print(f"Error updating conversation summary: {e}")


# ----------------------------
# POST endpoint for summary update (called by frontend after chat completes)
# ----------------------------
@router.post("/update-summary-async")
async def update_summary_async(
    request: Request,
    user_id: str = Depends(validate_access_token)
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
        await update_conversation_summary(user_id, session_id)
        logger.info(f"Completed async summary update for session {session_id}")

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error in update-summary-async: {e}")
        return {"status": "error", "message": str(e)}


async def get_textbook_context(textbook_id: str, chapter_id: str) -> str:
    """
    Retrieves textbook chapter content from S3.
    Expects S3 key pattern: {textbook_id}/chapter{chapter_id}.txt
    """
    try:
        text = await get_chapter_text(textbook_id, chapter_id)
        logger.info(f"Retrieved textbook context for {textbook_id}/chapter{chapter_id}: {len(text)} characters")
        return text
    except Exception as e:
        logger.error(f"Error retrieving textbook context for {textbook_id}/chapter{chapter_id}: {e}")
        return ""

# ----------------------------
# Non-Streaming POST Chat
# ----------------------------
@router.post("/message")
async def chat_message(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(validate_access_token)
):
    data = await request.json()
    user_message = data.get("message")
    session_id = data.get("session_id") or str(uuid.uuid4())
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    history = MongoChatMessageHistory(session_id=session_id)
    await history.add_message("user", user_message)

    recent_msgs = await history.get_messages(limit=10)
    llm_msgs: list[ChatCompletionMessageParam] = [{"role": "system", "content": chat_prompt}]
    for msg in recent_msgs:
        if msg["role"] in ["user", "assistant"]:
            llm_msgs.append({
                "role": msg["role"],
                "content": msg["content"]
            })

    response = generate_chat_completion(
        model="gpt-4o",
        messages=llm_msgs,
        user_id=user_id,
        trace_name="chat-message",
        temperature=0,
        session_id=session_id,
        metadata={"session_id": session_id}
    )

    if not hasattr(response, "choices") or not response.choices or len(response.choices) == 0:
        raise HTTPException(status_code=502, detail="OpenAI API returned no choices")

    ai_response = response.choices[0].message.content
    if ai_response is None:
        raise HTTPException(status_code=502, detail="OpenAI API returned empty content")
    await history.add_message("assistant", ai_response)

    # Frontend will trigger summary update after receiving the response
    return {"session_id": session_id, "ai_response": ai_response}




# ----------------------------
# Streaming POST
# ----------------------------
@router.post("/stream")
async def stream_chat(
request: Request,
background_tasks: BackgroundTasks,
user_id: str = Depends(validate_access_token)
):
    data = await request.json()
    user_message = data.get("message")
    textbook_id = data.get("textbook_id")
    chapter_id = data.get("chapter_id")
    session_id = data.get("session_id")

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")


    # Only generate new session if none is provided
    if not session_id:
        session_id = str(uuid.uuid4())
        print(f"Generated new session ID: {session_id}")

    history = MongoChatMessageHistory(session_id=session_id)

    important_messages_collection = MongoChatMessageHistory(session_id=session_id, collection_name="important_messages")
    important_msgs = await important_messages_collection.get_messages(limit=20)


    async def event_generator() -> AsyncGenerator[str, None]:
        collected_chunks: list[str] = []
        try:
            recent_msgs = await history.get_messages(limit=10)


            # Include textbook context & prior summary
            collection = await get_collection("conversation_summaries")
            summary_doc = await collection.find_one({"session_id": session_id, "user_id": user_id})
            print(f"Fetched conversation summary: {summary_doc}")
            summary_text = summary_doc.get("summary") if summary_doc else ""


            llm_msgs: list[ChatCompletionMessageParam] = [{"role": "system", "content": chat_prompt}]

            # Track important message identifiers to avoid duplication
            important_msg_ids = set()

            if important_msgs:
                llm_msgs.append({"role": "system", "content": "Important messages from the conversation:"})
                for msg in important_msgs:
                    if msg["role"] in ["user", "assistant"]:
                        llm_msgs.append({
                            "role": msg["role"],
                            "content": msg["content"]
                        })
                        # Track this message to avoid duplication in recent messages
                        msg_id = (msg["role"], msg["content"], str(msg.get("timestamp", "")))
                        important_msg_ids.add(msg_id)

            textbook_text = await get_textbook_context(textbook_id, chapter_id) if (textbook_id and chapter_id) else None
            if textbook_text:
                llm_msgs.append({"role": "system", "content": f"Textbook context: {textbook_text}"})
                print("Fine 1: Added textbook context to system message.")
            if summary_text:
                llm_msgs.append({"role": "system", "content": f"Conversation so far (summary): {summary_text}"})
                print("Fine 2: Added conversation summary to system message.")

            # Only add recent messages that aren't already in important messages
            for msg in recent_msgs:
                if msg["role"] in ["user", "assistant"]:
                    msg_id = (msg["role"], msg["content"], str(msg.get("timestamp", "")))
                    if msg_id not in important_msg_ids:
                        llm_msgs.append({
                            "role": msg["role"],
                            "content": str(msg["content"])
                        })
                        print(f"Fine 3/4: Added {msg['role']} message to history: {msg['content'][:30]}...")
                    else:
                        print(f"Skipped duplicate message (already in important messages): {msg['content'][:30]}...")

            llm_msgs.append({"role": "user", "content": str(user_message)})
            print(f"Fine 5: Added current user message: {user_message[:30]}...")

            stream = generate_chat_completion_stream(
                trace_name="chat-stream",
                model="gpt-4o-mini",
                messages=llm_msgs,
                user_id=user_id,
                temperature=0,
                session_id=session_id,
                metadata={
                    "session_id": session_id,
                    "chapter_id": chapter_id
                }
            )

            for chunk in stream:
                if len(chunk.choices) > 0 and chunk.choices[0].delta.content:
                    chunk_text = chunk.choices[0].delta.content
                    collected_chunks.append(chunk_text)
                    yield json.dumps({'text': chunk_text, 'session_id': session_id})

            full_response = "".join(collected_chunks)

            # Track the completed stream with Langfuse
            track_stream_completion(
                model="gpt-4o-mini",
                messages=llm_msgs,
                output=full_response,
                user_id=user_id,
                trace_name="chat-stream",
                temperature=0,
                session_id=session_id,
                metadata={
                    "session_id": session_id,
                    "textbook_id": textbook_id,
                    "chapter_id": chapter_id
                }
            )

            # Save both user message and assistant response to DB
            await history.add_message("user", user_message)
            await history.add_message("assistant", full_response)
            print(f"Saved user message and assistant response to history for session {session_id}.")

            # Frontend will trigger summary update after receiving the response
            # This ensures true non-blocking behavior with Lambda
            yield json.dumps({'done': True, 'session_id': session_id})

        except Exception as e:
            yield json.dumps({'done': True, 'error': str(e), 'session_id': session_id})


    return EventSourceResponse(event_generator())




# ----------------------------
# GET Chat History
# ----------------------------
@router.get("/history")
async def get_chat_history(
    session_id: Optional[str] = None,
    user_id: str = Depends(validate_access_token)
):
    try:
        if session_id:
            # Get specific chat history
            chat_history = MongoChatMessageHistory(session_id=session_id)
            messages = await chat_history.get_messages(limit=100)

            if not messages:
                raise HTTPException(status_code=404, detail="Chat not found")

            # Get summary from summary collection
            summary_collection = await get_collection("conversation_summaries")
            summary_doc = await summary_collection.find_one({
                "session_id": session_id,
                "user_id": user_id
            })

            for m in messages:
                if "_id" in m:
                    m["_id"] = str(m["_id"])
                if isinstance(m.get("timestamp"), (datetime, date)):
                    m["timestamp"] = m["timestamp"].isoformat()

            return {
                "session_id": session_id,
                "title": summary_doc.get("title", "Untitled Chat") if summary_doc else "Untitled Chat",
                "summary": summary_doc.get("summary", "") if summary_doc else "",
                "messages": messages
            }
        else:
            # Get all chat summaries for user
            summary_collection = await get_collection("conversation_summaries")
            summaries = await summary_collection.find({
                "user_id": user_id
            }).sort("updated_at", -1).to_list(100)

            chats = []
            for summary in summaries:
                chat_data = {
                    "session_id": summary["session_id"],
                    "title": summary.get("title", "Untitled Chat"),
                    "summary": summary.get("summary", ""),
                    "updated_at": summary["updated_at"].isoformat() if isinstance(summary.get("updated_at"), (datetime, date)) else summary.get("updated_at")
                }
                # Convert any remaining ObjectIds
                if "_id" in summary:
                    chat_data["_id"] = str(summary["_id"])
                chats.append(chat_data)

            return {"chats": chats}

    except Exception as e:
        logger.error(f"Error in get_chat_history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chat history")

# Convert timestamps to ISO strings
def convert_timestamps_to_iso(messages):
    for m in messages:
        if isinstance(m["timestamp"], (datetime, date)):
            m["timestamp"] = m["timestamp"].isoformat()

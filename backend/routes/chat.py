import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional, AsyncGenerator

from fastapi import APIRouter, Depends, Request, BackgroundTasks, HTTPException, status, Response
from sse_starlette.sse import EventSourceResponse

from langchain_openai import ChatOpenAI
from backend.graph import build_graph, get_system_prompt
from backend.database import get_collection
from backend.models.user import User
from backend.services.user import get_current_active_user

router = APIRouter()


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
            "timestamp": datetime.utcnow()
        })

    async def get_messages(self, limit: int = 50):
        collection = await get_collection(self.collection_name)
        cursor = collection.find({"session_id": self.session_id}).sort("timestamp", -1).limit(limit)
        messages = await cursor.to_list(length=limit)
        messages.sort(key=lambda m: m["timestamp"])
        return messages

    async def clear(self):
        collection = await get_collection(self.collection_name)
        await collection.delete_many({"session_id": self.session_id})


# ----------------------------
# Mongo Conversation Summary / Title
# ----------------------------
async def update_conversation_summary(user_id: str, session_id: str):
    """
    Generate conversation summary and dynamic title for a session.
    """
    try:
        # Get all messages
        history = MongoChatMessageHistory(session_id=session_id)
        messages = await history.get_messages(limit=1000)  # full session for summary

        # Build summarization input
        summarization_input = ""
        for msg in messages:
            role = "User" if msg["role"] == "user" else "AI"
            summarization_input += f"{role}: {msg['content']}\n"

        summary_llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

        prompt = f"""
Based on the conversation below, generate:
1. A concise conversation summary (under 200 words).
2. A one-line conversation title that captures the main topic.

Conversation:
{summarization_input}

Output as JSON:
{{
  "title": "<title>",
  "summary": "<summary>"
}}
"""

        result = await summary_llm.ainvoke(prompt)
        try:
            summary_json = json.loads(result.content)
            title = summary_json.get("title", "Chat Session")
            summary = summary_json.get("summary", "")
        except Exception:
            title = "Chat Session"
            summary = result.content

        # Upsert into Mongo
        collection = await get_collection("conversation_summaries")
        await collection.update_one(
            {"session_id": session_id, "user_id": user_id},
            {"$set": {
                "title": title,
                "summary": summary,
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
        print(f"Updated summary and title for session {session_id}")
    except Exception as e:
        print(f"Error updating conversation summary: {e}")


# ----------------------------
# Session Queue for Streaming
# ----------------------------
session_queues = {}  # session_id -> asyncio.Queue


# ----------------------------
# POST Chat - Non-streaming
# ----------------------------
@router.post("/message")
async def chat_message(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_active_user)
):
    data = await request.json()
    user_message = data.get("message")
    session_id = data.get("session_id") or str(uuid.uuid4())
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    user_id = current_user.id if current_user else "anonymous"
    history = MongoChatMessageHistory(session_id=session_id)
    await history.add_message("user", user_message)

    # Retrieve recent messages for context
    recent_msgs = await history.get_messages(limit=10)
    processed_msgs = []
    system_prompt = get_system_prompt()
    processed_msgs.append(system_prompt)
    for msg in recent_msgs:
        if msg["role"] == "user":
            processed_msgs.append({"role": "user", "content": msg["content"]})
        elif msg["role"] == "assistant":
            processed_msgs.append({"role": "assistant", "content": msg["content"]})

    processed_msgs.append({"role": "user", "content": user_message})

    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    ai_response = await llm.ainvoke(processed_msgs)
    await history.add_message("assistant", ai_response.content)

    # Background summary/title update
    background_tasks.add_task(update_conversation_summary, user_id, session_id)

    return {"session_id": session_id, "ai_response": ai_response.content}


# ----------------------------
# POST Chat - Streaming Initiate
# ----------------------------
@router.post("/initiate")
async def initiate_chat(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_active_user)
):
    data = await request.json()
    user_message = data.get("message")
    session_id = data.get("session_id") or str(uuid.uuid4())
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    user_id = current_user.id if current_user else "anonymous"
    history = MongoChatMessageHistory(session_id=session_id)
    await history.add_message("user", user_message)

    # Initialize queue for streaming
    if session_id not in session_queues:
        session_queues[session_id] = asyncio.Queue()

    # Start background streaming
    background_tasks.add_task(process_chat_message_stream, session_id, user_message, user_id)

    return {"session_id": session_id}


async def process_chat_message_stream(session_id: str, user_message: str, user_id: str):
    """
    Stream LLM output to queue for SSE.
    """
    try:
        history = MongoChatMessageHistory(session_id=session_id)
        recent_msgs = await history.get_messages(limit=10)
        processed_msgs = []
        system_prompt = get_system_prompt()
        processed_msgs.append(system_prompt)
        for msg in recent_msgs:
            if msg["role"] == "user":
                processed_msgs.append({"role": "user", "content": msg["content"]})
            elif msg["role"] == "assistant":
                processed_msgs.append({"role": "assistant", "content": msg["content"]})

        processed_msgs.append({"role": "user", "content": user_message})

        llm = ChatOpenAI(model="gpt-4o", temperature=0, streaming=True)
        full_response = ""
        async for event in llm.astream(processed_msgs):
            chunk = event.content
            if chunk:
                full_response += chunk
                # Save chunk to Mongo as assistant message (incremental)
                await history.add_message("assistant", chunk)
                # Push chunk to queue
                await session_queues[session_id].put({"text": chunk})

        # Signal done
        await session_queues[session_id].put({"done": True})
        # Trigger summary/title update
        await update_conversation_summary(user_id, session_id)

    except Exception as e:
        print(f"Error in streaming process: {e}")
        await session_queues[session_id].put({"error": str(e), "done": True})


# ----------------------------
# GET Chat - Streaming
# ----------------------------
@router.get("/stream/{session_id}")
async def stream_chat(session_id: str):
    if session_id not in session_queues:
        session_queues[session_id] = asyncio.Queue()

    async def event_generator() -> AsyncGenerator[str, None]:
        queue = session_queues[session_id]
        try:
            while True:
                data = await queue.get()
                yield json.dumps(data)
                if data.get("done"):
                    break
        except Exception as e:
            yield json.dumps({"error": str(e), "done": True})

    return EventSourceResponse(event_generator())


# ----------------------------
# GET Chat History
# ----------------------------
@router.get("/history")
async def get_chat_history(
    current_user: User = Depends(get_current_active_user),
    session_id: Optional[str] = None
):
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access chat history",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session_id = session_id or str(uuid.uuid4())
    history = MongoChatMessageHistory(session_id=session_id)
    messages = await history.get_messages(limit=100)

    return [
        {"role": msg["role"], "content": msg["content"]}
        for msg in messages
    ]

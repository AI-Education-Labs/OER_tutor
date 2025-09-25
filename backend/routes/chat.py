import json
import uuid
from datetime import datetime
from typing import Optional, AsyncGenerator

from fastapi import APIRouter, Depends, Request, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.graph import build_graph, get_system_prompt
from backend.database import get_collection
from backend.models.user import User
from backend.services.auth import get_current_active_user
from backend.textextract import text_extract

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


# ----------------------------
# Conversation Summary / Title
# ----------------------------

async def update_conversation_summary(user_id: str, session_id: str):
    try:
        history = MongoChatMessageHistory(session_id=session_id)
        messages = await history.get_messages(limit=1000)

        llm_msgs = []
        for msg in messages:
            if msg["role"] == "user":
                llm_msgs.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                llm_msgs.append(AIMessage(content=msg["content"]))

        # prepend system message (not included in prompt_content later)
        system_prompt = SystemMessage(
            content="Generate a concise conversation summary and a one-line title."
        )
        llm_msgs.insert(0, system_prompt)

        summary_llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

        # exclude system messages when building conversation content
        prompt_content = "\n".join([
            f"{'user' if isinstance(m, HumanMessage) else 'assistant'}: {m.content}"
            for m in llm_msgs if not isinstance(m, SystemMessage)
        ])

        result = await summary_llm.ainvoke(
            f"Based on the conversation below, generate JSON with 'title' and 'summary':\n{prompt_content}"
        )

        try:
            summary_json = json.loads(result.content)
            title = summary_json.get("title", "Chat Session")
            summary = summary_json.get("summary", "")
        except Exception:
            title = "Chat Session"
            summary = result.content

        collection = await get_collection("conversation_summaries")
        await collection.update_one(
            {"session_id": session_id, "user_id": user_id},
            {"$set": {"title": title, "summary": summary, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    except Exception as e:
        print(f"Error updating conversation summary: {e}")


async def get_textbook_context(textbook_id: str, chapter_id: str) -> str:
    try:
        pdf_path = f"./public/textbooks/{textbook_id}/chapter{chapter_id}_repaired.pdf"
        text = text_extract(pdf_path)
        return text
    except Exception as e:
        print(f"Error retrieving textbook context: {e}")
        return ""

# ----------------------------
# Non-Streaming POST Chat
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

    recent_msgs = await history.get_messages(limit=10)
    llm_msgs = [SystemMessage(content=get_system_prompt())]
    for msg in recent_msgs:
        if msg["role"] == "user":
            llm_msgs.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            llm_msgs.append(AIMessage(content=msg["content"]))
    llm_msgs.append(HumanMessage(content=user_message))

    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    ai_response = await llm.ainvoke(llm_msgs)
    await history.add_message("assistant", ai_response.content)

    background_tasks.add_task(update_conversation_summary, user_id, session_id)

    return {"session_id": session_id, "ai_response": ai_response.content}

# ----------------------------
# Streaming POST
# ----------------------------

@router.post("/stream")
async def stream_chat(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_active_user)
):
    data = await request.json()
    user_message = data.get("message")
    textbook_id = data.get("textbook_id")
    chapter_id = data.get("chapter_id")
    session_id = data.get("session_id")
    print(f"Received textbook_id: {textbook_id}, chapter_id: {chapter_id}")

    # Only generate a new session if none is provided
    new_session = False
    if not session_id:
        session_id = str(uuid.uuid4())
        print(f"Generated new session ID: {session_id}")
        new_session = True

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    user_id = current_user.id if current_user else "anonymous"
    history = MongoChatMessageHistory(session_id=session_id)
    await history.add_message("user", user_message)

    async def event_generator() -> AsyncGenerator[str, None]:
        collected_chunks: list[str] = []
        try:
            recent_msgs = await history.get_messages(limit=10)
            collection = await get_collection("conversation_summaries")
            summary_doc = await collection.find_one({"session_id": session_id, "user_id": user_id})
            summary_text = summary_doc.get("summary") if summary_doc else None
            llm_msgs = [get_system_prompt()]
            textbook_text = await get_textbook_context(textbook_id, chapter_id) if (textbook_id and chapter_id) else None
            llm_msgs.append(SystemMessage(content=f"Textbook context: {textbook_text}") if textbook_text else None)
            # Add summary if it exists
            if summary_text:
                llm_msgs.append(SystemMessage(content=f"Conversation so far (summary): {summary_text}"))
            #print(f"Recent Messages for Context: {recent_msgs}")
            #print(f"Summary Text: {summary_text}")
            for msg in recent_msgs:
                content = msg["content"]
                if msg["role"] == "user":
                    llm_msgs.append(HumanMessage(content=str(content)))
                elif msg["role"] == "assistant":
                    llm_msgs.append(AIMessage(content=str(content)))

            llm_msgs.append(HumanMessage(content=str(user_message)))
            llm = ChatOpenAI(model="gpt-4o", temperature=0, streaming=True, use_responses_api=True)

            async for chunk in llm.astream(llm_msgs):
                if chunk.content:
                    if isinstance(chunk.content, list):
                        text_parts = [item["text"] for item in chunk.content if isinstance(item, dict) and "text" in item]
                        chunk_text = "".join(text_parts)
                    else:
                        chunk_text = str(chunk.content)

                    collected_chunks.append(chunk_text)
                    yield json.dumps({'text': chunk_text, 'session_id': session_id})  # return session_id with chunks

            full_response = "".join(collected_chunks)
            await history.add_message("assistant", full_response)
            background_tasks.add_task(update_conversation_summary, user_id, session_id)

            yield json.dumps({'done': True, 'session_id': session_id})

        except Exception as e:
            yield json.dumps({'done': True, 'error': str(e), 'session_id': session_id})

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
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    session_id = session_id or str(uuid.uuid4())
    history = MongoChatMessageHistory(session_id=session_id)
    messages = await history.get_messages(limit=100)
    llm_msgs = []
    for msg in messages:
        if msg["role"] == "user":
            llm_msgs.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            llm_msgs.append(AIMessage(content=msg["content"]))
    return [{"role": m.role.lower(), "content": m.content} for m in llm_msgs]

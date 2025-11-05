import json
import uuid
from datetime import datetime, date
from typing import Optional, AsyncGenerator

from bson import ObjectId
import logging

from fastapi import APIRouter, Depends, Request, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse
from openai import chat
from sse_starlette.sse import EventSourceResponse

from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, BaseMessage

from backend.graph import get_system_prompt
from backend.features.users.models import User
from backend.features.auth.service import validate_cookie_token
from backend.features.textbooks.service import get_textbook_chapter_txt
from backend.features.chat.models import *


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
           "timestamp": datetime.utcnow()
       })


   async def get_messages(self, limit: int = 50):
       collection = await get_collection(self.collection_name)
       cursor = collection.find({"session_id": self.session_id}).sort("timestamp", -1).limit(limit)
       messages = await cursor.to_list(length=limit)
       messages.sort(key=lambda m: m["timestamp"])
       return messages


# ----------------------------
# Non-Streaming POST Chat
# ----------------------------
@router.post("/message")
async def chat_message(chat: ChatRequest, user_id: str = Depends(validate_cookie_token)):
    """
    Handle a single non-streaming chat message from an authenticated user.

    Parameters:
    - user_message (str): The text message from the user. Required. If empty, the function raises HTTPException(status_code=400).
    - textbook_id (str): The ID of the textbook being referenced
    - chapter_id (str): The ID of the chapter being referenced
    - session_id (Optional[str]): An existing session identifier to continue a conversation. If omitted or falsy, a new UUID4 session_id is generated and returned. This value is used to scope message history in MongoChatMessageHistory.
    """
    
    user_message = chat.user_message
    session_id = chat.session_id or str(uuid.uuid4())
    if not user_message:
       raise HTTPException(status_code=400, detail="Message cannot be empty")

    history = MongoChatMessageHistory(session_id=session_id)
    await history.add_message("user", user_message)

    recent_msgs = await history.get_messages(limit=10)
    llm_msgs: list[BaseMessage] = []
    llm_msgs.append(SystemMessage(content=str(get_system_prompt())))
    for msg in recent_msgs:
        if msg["role"] == "user":
            llm_msgs.append(HumanMessage(content=str(msg["content"])))
        elif msg["role"] == "assistant":
            llm_msgs.append(AIMessage(content=str(msg["content"])))
    llm_msgs.append(HumanMessage(content=str(user_message)))

    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    ai_response = await llm.ainvoke(llm_msgs)
    ai_content = ai_response.content if hasattr(ai_response, 'content') else ai_response
    if not isinstance(ai_content, str):
        ai_content = str(ai_content)
    await history.add_message("assistant", ai_content)

    return {"session_id": session_id, "ai_response": ai_response.content}




# ----------------------------
# Streaming POST
# ----------------------------
@router.post("/stream", )
async def stream_chat(chat: ChatRequest, user_id: str = Depends(validate_cookie_token)):
    """
    Handle a single non-streaming chat message from an authenticated user.

    Parameters:
    - user_message (str): The text message from the user. Required. If empty, the function raises HTTPException(status_code=400).
    - textbook_id (str): The ID of the textbook being referenced
    - chapter_id (str): The ID of the chapter being referenced
    - session_id (Optional[str]): An existing session identifier to continue a conversation. If omitted or falsy, a new UUID4 session_id is generated and returned. This value is used to scope message history in MongoChatMessageHistory.
    """
    if not chat.user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Only generate new session if none is provided
    if not chat.session_id:
        chat.session_id = str(uuid.uuid4())

    history = MongoChatMessageHistory(session_id=chat.session_id)
    await history.add_message("user", chat.user_message)
    print(f"Added user message to history for session {chat.session_id}.")
    important_messages_collection = MongoChatMessageHistory(session_id=chat.session_id, collection_name="important_messages")
    important_msgs = await important_messages_collection.get_messages(limit=20)

    async def event_generator() -> AsyncGenerator[str, None]:
        collected_chunks: list[str] = []
        try:
            recent_msgs = await history.get_messages(limit=10)

            # Include textbook context & prior summary
            collection = await get_collection("conversation_summaries")
            summary_doc = await collection.find_one({"session_id": chat.session_id, "user_id": user_id})
            print(f"Fetched conversation summary: {summary_doc}")
            summary_text = summary_doc.get("summary") if summary_doc else ""


            llm_msgs: list[BaseMessage] = [get_system_prompt()]

            if important_msgs:
                llm_msgs.append(SystemMessage(content="Important messages from the conversation:"))
                for msg in important_msgs:
                    if msg["role"] == "user":
                        llm_msgs.append(HumanMessage(content=msg["content"]))
                    elif msg["role"] == "assistant":
                        llm_msgs.append(AIMessage(content=msg["content"]))

            try:
                textbook_text = await get_textbook_chapter_txt(chat.textbook_id, chat.chapter_id)
                print(textbook_text)
                if textbook_text:
                    llm_msgs.append(SystemMessage(content=f"Textbook context: {textbook_text}"))
                    print("Fine 1: Added textbook context to system message.")
            except Exception as e:
                print(f"Error fetching textbook chapter text: {e}")
                # Optionally, you can append a system message indicating missing context
                llm_msgs.append(SystemMessage(content="Textbook context unavailable."))
            if summary_text:
                llm_msgs.append(SystemMessage(content=f"Conversation so far (summary): {summary_text}"))
                print("Fine 2: Added conversation summary to system message.")


            for msg in recent_msgs:
                if msg["role"] == "user":
                    llm_msgs.append(HumanMessage(content=str(msg["content"])))
                    print(f"Fine 3: Added user message to history: {msg['content'][:30]}...")
                elif msg["role"] == "assistant":
                    llm_msgs.append(AIMessage(content=str(msg["content"])))
                    print(f"Fine 4: Added assistant message to history: {msg['content'][:30]}...")


            llm_msgs.append(HumanMessage(content=str(chat.user_message)))
            print(f"Fine 5: Added current user message: {chat.user_message[:30]}...")
            llm = ChatOpenAI(model="gpt-5-mini", temperature=0, streaming=True, tags=["Chatter"], reasoning_effort="minimal")#, use_responses_api=True)


            async for chunk in llm.astream(llm_msgs):
                if chunk.content:
                    if isinstance(chunk.content, list):
                        text_parts = [item["text"] for item in chunk.content if isinstance(item, dict) and "text" in item]
                        chunk_text = "".join(text_parts)
                    else:
                        chunk_text = str(chunk.content)
                    collected_chunks.append(chunk_text)
                    yield json.dumps({'text': chunk_text, 'session_id': chat.session_id})


            full_response = "".join(collected_chunks)
            await history.add_message("assistant", full_response)


            # --- Branch decision ---
            try:
                detector_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, tags=["branch-detector"], reasoning_effort="low", )
                recent = await history.get_messages(limit=10)
                conv_text = "\n".join([f"{m['role']}: {m['content']}" for m in recent])
                detector_prompt = (
                    'Decide whether the last user message starts a new topic. '
                    'Respond ONLY with JSON: {"start_new_chat": true/false, "suggested_title": string}'
                    f'\nConversation:\n{conv_text}'
                )
                result = await detector_llm.ainvoke(detector_prompt)
                print("===================================================")
                print("Branch detector response:", result.content)
                print("===================================================")
                # Simplified normalization and parsing
                content = result.content
                decision = None
                if isinstance(content, dict):
                    decision = content
                elif isinstance(content, str):
                    try:
                        decision = json.loads(content)
                    except Exception:
                        decision = {"start_new_chat": False}
                elif isinstance(content, list):
                    # If list of dicts, merge them; if list of strings, join and parse
                    if all(isinstance(item, dict) for item in content):
                        # Merge dicts (last one wins)
                        merged = {}
                        for item in content:
                            # Guard the merge at runtime so static type checkers don't complain
                            if isinstance(item, dict):
                                merged = {**merged, **item}
                        decision = merged
                    elif all(isinstance(item, str) for item in content):
                        try:
                            decision = json.loads("".join(content))
                        except Exception:
                            decision = {"start_new_chat": False}
                    else:
                        decision = {"start_new_chat": False}
                else:
                    decision = {"start_new_chat": False}
            except Exception:
                decision = {"start_new_chat": False}


            if decision.get("start_new_chat"):
                print("==================================================")
                print("Starting new chat session as per LLM decision.")
                print("==================================================")
                new_session_id = str(uuid.uuid4())
                new_history = MongoChatMessageHistory(session_id=new_session_id)
                await new_history.add_message("user", chat.user_message)
                await new_history.add_message("assistant", full_response)


                yield json.dumps({
                    'start_new_chat': True,
                    'new_session_id': new_session_id,
                    'suggested_title': decision.get("suggested_title", "New Chat")
                })
            else:
                print("unable to parse json")
                print("Response content:", result.content)
                print("Desicion:", decision)
                print("==================================================")


            yield json.dumps({'done': True, 'session_id': chat.session_id})


        except Exception as e:
            yield json.dumps({'done': True, 'error': str(e), 'session_id': chat.session_id})

    return EventSourceResponse(event_generator())




# ----------------------------
# GET Chat History
# ----------------------------
@router.get("/history")
async def get_chat_history(
    session_id: Optional[str] = None,
    user_id: str = Depends(validate_cookie_token)
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
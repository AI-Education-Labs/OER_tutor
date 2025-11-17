import json
import uuid
from datetime import datetime, date
from typing import Optional, AsyncGenerator

from bson import ObjectId
import logging

from fastapi import APIRouter, Depends, Request, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse


from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage


from backend.graph import get_system_prompt
from backend.db.database import get_collection
from backend.features.users.models import User
from backend.features.auth.service import validate_access_token
from backend.routes.textbooks import get_chapter_text


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
# Conversation Summary / Title
# ----------------------------
async def update_conversation_summary(user_id: str, session_id: str):
   try:
       llm_msgs = []

       history = MongoChatMessageHistory(session_id=session_id)
       messages = await history.get_messages(limit=10)

       important_messages_collection = MongoChatMessageHistory(session_id=session_id, collection_name="important_messages")
       important_messages = await important_messages_collection.get_messages(limit=20)

       llm_msgs.append(SystemMessage(content="Important messages from the conversation:"))
       if important_messages:
           for msg in important_messages:
               if msg["role"] == "user":
                   llm_msgs.append(HumanMessage(content=msg["content"]))
               elif msg["role"] == "assistant":
                   llm_msgs.append(AIMessage(content=msg["content"]))


       llm_msgs.append(SystemMessage(content="Recent messages:"))
       for msg in messages:
           if msg["role"] == "user":
               llm_msgs.append(HumanMessage(content=msg["content"]))
           elif msg["role"] == "assistant":
               llm_msgs.append(AIMessage(content=msg["content"]))


       system_prompt = SystemMessage(
           content="Update the conversation summary with new information, and decide if the recent messages need to be added to important messages."
       )
       llm_msgs.insert(0, system_prompt)


       summary_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, tags=["summary-updater"], reasoning_effort="low", )


       prompt_content = "\n".join([
           f"{'user' if isinstance(m, HumanMessage) else 'assistant' if isinstance(m, AIMessage) else 'system'}: {m.content}"
           for m in llm_msgs
       ])

       # Get existing summary and title
       collection = await get_collection("conversation_summaries")
       existing_doc = await collection.find_one({"session_id": session_id, "user_id": user_id})
       existing_title = existing_doc.get("title") if existing_doc else None
       existing_summary = existing_doc.get("summary") if existing_doc else None

       prompt = f"""
You are an assistant that UPDATES conversation summaries and finds important messages.

EXISTING TITLE: {existing_title or "None - create a simple 2-4 word title"}
EXISTING SUMMARY: {existing_summary or "None - create initial summary"}

Return valid JSON with exactly these keys:
- "title": If existing title is good and still fits the conversation, KEEP IT EXACTLY THE SAME. Only change if conversation topic has significantly shifted. Keep it very simple: 2-4 words (e.g., "Psychology Methods", "Chapter Discussion"). DO NOT add unnecessary details like dates or chapter numbers unless critical.

- "summary": If existing summary exists, UPDATE it by ADDING new information. DO NOT replace the entire summary - build upon it. Format: "Previous topics: [old info]. New discussion: [new info]". Keep it concise but comprehensive.

- "important_messages": a list of truly important messages (same guidelines as before) no duplicates from existing important messages. Only add messages that contain ESSENTIAL information, instructions, or insights. DO NOT include greetings, filler, or procedural messages.

Guidelines for "important_messages":
1. Only include messages with essential information or insights
2. Exclude greetings, filler, procedural messages
3. Include detailed instructions/plans verbatim as single messages
4. Do not split long messages
5. Empty list if no important messages
6. Do not duplicate messages already in the conversation

Data:
{prompt_content}
"""

       result = await summary_llm.ainvoke(prompt)


       try:
           summary_json = json.loads(result.content)
           new_title = summary_json.get("title", existing_title or "Chat Session")
           new_summary = summary_json.get("summary", "")
           important_msgs = summary_json.get("important_messages", None)
       except Exception:
           new_title = existing_title or "Chat Session"
           new_summary = result.content

       if isinstance(important_msgs, list):
           for msg in important_msgs:
                if isinstance(msg, dict) and "role" in msg and "content" in msg:
                    await important_messages_collection.add_message(msg["role"], msg["content"])

       await collection.update_one(
           {"session_id": session_id, "user_id": user_id},
           {"$set": {"title": new_title, "summary": new_summary, "updated_at": datetime.utcnow()}},
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


async def branch_decision_handler(history: MongoChatMessageHistory, user_message: str, full_response: str, user_id: str, background_tasks: BackgroundTasks) -> AsyncGenerator[str, None]:
    """
    Determines if a message indicates a branching decision point
    And returns
    """
    # --- Branch decision ---
    try:
        detector_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, tags = ["branch-detector"], reasoning_effort="low", )
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
        decision = json.loads(result.content)
    except Exception:
        decision = {"start_new_chat": False}


    if decision.get("start_new_chat"):
        print("==================================================")
        print("Starting new chat session as per LLM decision.")
        print("==================================================")
        new_session_id = str(uuid.uuid4())
        new_history = MongoChatMessageHistory(session_id=new_session_id)
        await new_history.add_message("user", user_message)
        await new_history.add_message("assistant", full_response)
        background_tasks.add_task(update_conversation_summary, user_id, new_session_id)


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

   # Frontend will trigger summary update after receiving the response
   return {"session_id": session_id, "ai_response": ai_response.content}




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
   # Note: We save the user message to DB AFTER the LLM call (see line ~355)
   # This way we explicitly append it to recent_msgs for the LLM without duplication
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


           llm_msgs = [get_system_prompt()]

           if important_msgs:
               llm_msgs.append(SystemMessage(content="Important messages from the conversation:"))
               for msg in important_msgs:
                   if msg["role"] == "user":
                       llm_msgs.append(HumanMessage(content=msg["content"]))
                   elif msg["role"] == "assistant":
                       llm_msgs.append(AIMessage(content=msg["content"]))

           textbook_text = await get_textbook_context(textbook_id, chapter_id) if (textbook_id and chapter_id) else None
           if textbook_text:
               llm_msgs.append(SystemMessage(content=f"Textbook context: {textbook_text}"))
               print("Fine 1: Added textbook context to system message.")
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

           # Append the current user message (not yet saved to DB)
           llm_msgs.append(HumanMessage(content=str(user_message)))
           print(f"Fine 5: Added current user message: {user_message[:30]}...")
           llm = ChatOpenAI(model="gpt-5-mini", temperature=0, streaming=True, tags=["Chatter"], reasoning_effort="minimal")#, use_responses_api=True)


           async for chunk in llm.astream(llm_msgs):
               if chunk.content:
                   if isinstance(chunk.content, list):
                       text_parts = [item["text"] for item in chunk.content if isinstance(item, dict) and "text" in item]
                       chunk_text = "".join(text_parts)
                   else:
                       chunk_text = str(chunk.content)
                   collected_chunks.append(chunk_text)
                   yield json.dumps({'text': chunk_text, 'session_id': session_id})


           full_response = "".join(collected_chunks)

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
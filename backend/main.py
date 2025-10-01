from fastapi import FastAPI, Depends, HTTPException, status, Header, Query, BackgroundTasks, Request, Response
from sse_starlette.sse import EventSourceResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, AsyncGenerator
import json
import logging
import asyncio
import os

from backend.redis_client import redis_client

from backend.routes.auth import router as auth_router

from backend.routes.llm_utils import router as llm_utils_router
from backend.routes.textbooks import router as textbooks_router
from backend.routes.files import router as files_router
from backend.routes.sidebar_modules import router as sidebar_modules_router
from backend.routes.user_progress import router as textbook_progress_router
from backend.routes.textbook_information import router as textbook_router
from backend.routes.users import router as users_router
from backend.routes.user_books import router as user_books_router

from langchain_openai import ChatOpenAI
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.session_manager import session_manager
from backend.graph import build_graph, get_system_prompt
from backend.config import settings

import mangum

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

from backend.db.database import ensure_mongo_connection, get_user_by_username

from backend.features.users.models import User
from backend.features.auth.service import validate_access_token

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="TextbookAI API")
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(llm_utils_router, prefix="/llm", tags=["llm-utils"])
app.include_router(sidebar_modules_router, prefix="/sidebar", tags=["sidebar-modules"])
app.include_router(textbooks_router, tags=["textbooks"])
app.include_router(files_router, tags=["files"])
app.include_router(textbook_progress_router, prefix="/progress", tags=["progress"])
app.include_router(textbook_router, prefix="/textbook", tags=["textbook"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(user_books_router, tags=["user-books"]) 

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis URL configuration from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB_CHAT", "1")
REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

retriever = None

# Routes

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(validate_access_token)):
    """
    Returns the current authenticated user's information.
    """
    return current_user

@app.post("/chat/initiate")
async def initiate_chat(
    request: Request,
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Depends(validate_access_token),
):
    """
    Initiates a chat session and starts processing in the background.
    Returns immediately with a session ID.
    """
    data = await request.json()
    message = data.get("message")
    session_id = data.get("session_id")

    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Create session in Redis
    session_id = await session_manager.create_session(
        user_id=user_id,
        message=message,
        session_id=session_id
    )
    
    # Start processing in background
    background_tasks.add_task(
        process_chat_message,
        session_id=session_id,
        user_message=message,
        user_id=user_id
    )

    response = {"success": True, "session_id": session_id}
    
    # Add session-id header for compatibility
    return Response(
        content=json.dumps(response),
        media_type="application/json",
        headers={"session-id": session_id}
    )

async def process_chat_message(session_id: str, user_message: str, user_id: Optional[str]):
    """
    Processes a chat message in the background and puts chunks into the Redis queue.
    """
    
    try:
        # Check if session exists
        if not await session_manager.session_exists(session_id):
            print(f"Session {session_id} not found")
            return
        
        # Update session status
        await session_manager.update_session(session_id, {"status": "processing"})
        
        # Add this debug code
        all_keys = await redis_client.keys("*")
        print(f"All Redis keys: {all_keys}")

        # Check LangChain's key format
        langchain_keys = await redis_client.keys("message_store:*")
        print(f"LangChain message keys: {langchain_keys}")

        # Get the existing summary from Redis
        summary_key = f"summary:{user_id}"
        conversation_summary = await redis_client.get(summary_key)
        
        # Get system prompt
        system_prompt = get_system_prompt()
        
        # Prepare messages for the LLM
        processed_messages = []
        
        # Always include system prompt first
        processed_messages.append(system_prompt)
        
        # Add conversation summary if available
        if conversation_summary:
            processed_messages.append(SystemMessage(content=f"Previous conversation summary: {conversation_summary}"))
        
        # Get the most recent messages (for immediate context)
        history = RedisChatMessageHistory(session_id=user_id, url=REDIS_URL)
        print(f"History: {history.messages}")
        recent_messages = history.messages[-5:] if len(history.messages) > 5 else history.messages
        
        # Filter out system messages from recent messages (we already added the system prompt)
        recent_messages = [msg for msg in recent_messages if not isinstance(msg, SystemMessage)]
        processed_messages.extend(recent_messages)
        
        # Add the current message
        processed_messages.append(HumanMessage(content=user_message))
        
        # Initialize LLM and graph
        llm = ChatOpenAI(model="gpt-4o", temperature=0, streaming=True)
        graph = build_graph(llm, retriever)

        # Initialize tracking variables
        current_ai_message = None
        full_response = ""

        # Process the message with the LLM
        async for event in graph.astream(
            {"messages": processed_messages},
            {"configurable": {"thread_id": session_id}}
        ):
            for value in event.values():
                if len(value["messages"]) > 0:
                    # Get the latest message
                    latest_msg = value["messages"][-1]

                    # Only process if it's an AI message (not tool output or retrieval results)
                    if isinstance(latest_msg, AIMessage):
                        if current_ai_message is None or latest_msg.id != current_ai_message.id:
                            current_ai_message = latest_msg
                        
                        # If this is an update to the current AI message and it has content
                        if hasattr(latest_msg, "content") and isinstance(latest_msg.content, str):
                            # Calculate the new chunk (only the part that's been added)
                            new_content = latest_msg.content
                            new_chunk = new_content[len(full_response):] if full_response else new_content
                            
                            if new_chunk:
                                full_response = new_content
                                # Push chunk to Redis queue
                                await session_manager.push_to_queue(session_id, {"text": new_chunk})
        
        # Save to history if user is authenticated
        history.add_user_message(user_message)
        history.add_ai_message(full_response)
        
        # Schedule the summary update as a background task
        await update_conversation_summary(
            user_id=user_id,
            user_message=user_message,
            ai_response=full_response
        )

        # Signal completion
        await session_manager.push_to_queue(session_id, {"done": True})
        await session_manager.update_session(session_id, {"status": "completed"})

    except Exception as e:
        print(f"Error processing chat message: {e}")
        await session_manager.update_session(session_id, {"status": "error"})
        await session_manager.push_to_queue(session_id, {"error": str(e), "done": True})


@app.get("/chat/stream/{session_id}")
async def stream_chat_response(
    session_id: str,
    user_id: Optional[str] = Depends(validate_access_token)
) -> EventSourceResponse:
    """
    Streams the chat response for a given session ID using Redis queues.
    """
    # Check if session exists
    session_data = await session_manager.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate events for SSE streaming from Redis queue."""
        try:
            while True:
                # Pop data from Redis queue with timeout
                data = await session_manager.pop_from_queue(session_id, timeout=60)
                
                if data is None:
                    # Timeout occurred, send keepalive
                    # DON'T include "data: " prefix - EventSourceResponse adds it automatically
                    yield json.dumps({'keepalive': True})
                    
                    # Check if the session is still active
                    session_data = await session_manager.get_session(session_id)
                    if session_data and session_data["status"] in ["completed", "error"]:
                        yield json.dumps({'done': True})
                        break
                    continue
                
                # DON'T include "data: " prefix - EventSourceResponse adds it automatically
                yield json.dumps(data)
                
                # If done flag is set, exit the loop
                if data.get("done", False):
                    break
                    
        except Exception as e:
            print(f"Error in event generator: {e}")
            yield json.dumps({'error': str(e), 'done': True})
        finally:
            # Schedule cleanup after streaming is complete
            asyncio.create_task(cleanup_session_delayed(session_id))
    
    return EventSourceResponse(event_generator())

async def cleanup_session_delayed(session_id: str, delay: int = 300):
    """
    Cleans up a session after a delay.
    """
    await asyncio.sleep(delay)  # Keep the session data for 5 minutes
    await session_manager.delete_session(session_id)
    print(f"Cleaned up session {session_id}")

@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup."""
    asyncio.create_task(periodic_cleanup())

async def periodic_cleanup():
    """Periodically clean up expired sessions."""
    while True:
        try:
            await session_manager.cleanup_expired_sessions()
            await asyncio.sleep(300)  # Run every 5 minutes
        except Exception as e:
            print(f"Error in periodic cleanup: {e}")
            await asyncio.sleep(60)  # Wait 1 minute before retrying

async def update_conversation_summary(user_id: str, user_message: str, ai_response: str):
    """Update conversation summary with corrected parameter names."""
    try:
        summary_key = f"summary:{user_id}"
        existing_summary = await redis_client.get(summary_key)

        history = RedisChatMessageHistory(session_id=user_id, url=REDIS_URL)
        all_messages = history.messages if history.messages else []

        summary_llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
        
        summarization_input = ""
        if existing_summary:
            summarization_input += f"Previous summary: {existing_summary}\n\n"
        
        summarization_input += f"New exchange:\nUser: {user_message}\nAI: {ai_response}\n\n"
        
        updated_summary = await summary_llm.ainvoke(
            f"""Based on the information provided, create or update the conversation summary.
            Keep the summary concise (under 200 words) but include key topics, questions, and insights.
            Focus on the main themes and important details that would be relevant for future responses.
            
            {summarization_input}
            
            Updated summary:"""
        )

        await redis_client.set(summary_key, updated_summary.content)
        print(f"Updated summary for user {user_id}")

    except Exception as e:
        print(f"Error updating conversation summary: {e}")


@app.get("/chat/history")
async def get_chat_history(current_user: User = Depends(validate_access_token)):
    try:
        history = RedisChatMessageHistory(
            session_id=current_user.id,
            url=REDIS_URL,
        )
        chat_history = history.messages  # List of HumanMessage / AIMessage objects
        return [
            {
                "role": "user" if isinstance(m, HumanMessage) else "assistant",
                "content": m.content
            } for m in chat_history
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving chat history: {str(e)}",
        )

handler = mangum.Mangum(app)

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
    asyncio.run(ensure_mongo_connection())

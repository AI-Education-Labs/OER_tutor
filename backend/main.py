from fastapi import FastAPI, Depends, HTTPException, status, Header, Query, BackgroundTasks, Request, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, AsyncGenerator
from datetime import datetime, timezone
import jwt
import json
import random
import re
import logging
import asyncio
import uuid
import os

from backend.redis_client import redis_client

from backend.routes.auth import get_user_by_id
from backend.routes.auth import router as auth_router
from backend.routes.user_progress import router as textbook_progress_router
from backend.routes.textbook_information import router as textbook_router

from openai import OpenAI

from langchain_openai import ChatOpenAI
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.session_manager import session_manager

import backend.retriever

from backend.graph import build_graph, get_system_prompt

from backend.config import settings

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")



PDF_DIR = "./public"

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="TextbookAI API")
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(textbook_progress_router, prefix="/progress", tags=["progress"])
app.include_router(textbook_router, prefix="/textbook", tags=["textbook"])

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Configuration
SECRET_KEY = settings.SECRET_KEY  # Use your secret key from settings
ALGORITHM = settings.ALGORITHM  # Use your algorithm from settings
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES  # Use your token expiration time from settings

# Redis URL configuration from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB_CHAT", "1")
REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Models - using str instead of EmailStr
class User(BaseModel):
    id: str
    username: str
    email: str  # Changed from EmailStr to str
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserCreate(User):
    password: str

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ChatMessage(BaseModel):
    message: str

class QuizOption(BaseModel):
    id: str
    text: str
    isCorrect: bool

class Quiz(BaseModel):
    question: str
    options: List[QuizOption]
    explanation: Optional[str] = None

class ChatResponse(BaseModel):
    response: Optional[str] = None
    saved: bool = False
    isQuiz: bool = False
    quiz: Optional[Quiz] = None

class QuizAnswer(BaseModel):
    messageId: str
    optionId: str
    isCorrect: bool

class SubchapterProgress(BaseModel):
    completed: bool = False
    progress: float = 0.0  # % of the subchapter completed
    time_spent: float = 0.0  # in minutes

class ChapterProgress(BaseModel):
    completed: bool = False
    progress: float = 0.0  # % of the chapter completed
    subchapters: Dict[str, SubchapterProgress] = Field(default_factory=dict)

class UserProgress(BaseModel):
    user_id: str = ""
    textbook_id: str = ""
    overall_progress: float = 0.0  # e.g. 42.5 (%)
    chapters: Dict[str, ChapterProgress] = Field(default_factory=dict)
    total_answers: int = 0
    correct_answers: int = 0
    streak: int = 0
    xp: int = 0
    level: int = 1
    last_answer_time: Optional[datetime] = None
    topics_mastered: List[str] = Field(default_factory=list)
    

class Chapter(BaseModel):
    id: int
    title: str
    file: str

class TextbookInfo(BaseModel):
    id: str
    title: str
    chapters: List[Chapter]

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

retriever = backend.retriever.create_retriever("data/Research-Methods-in-Psychology_repaired.pdf", "Research_Methods_in_Psychology")   # We need to pass in what retriever the chat is going to use, then build it for the user. Since the chroma is already initialized it shouldnt waste time.

# Authentication helper functions
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Validates JWT token and returns the user if valid.
    Returns None for unauthenticated requests.
    """
    if token is None:
        return None
        
    try:
        # Decode the token (verify its signature and expiration)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")  # 'sub' is the typical key for user ID in JWT
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing user information",
            )

        # Optionally, you could verify token expiration here:
        expiration = payload.get("exp")
        if expiration and datetime.fromtimestamp(expiration, timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )

        # Assuming you have a function to get the user from your DB
        user = await get_user_by_id(user_id)  # Replace with your DB fetching logic
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return user
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

async def get_current_active_user(current_user: Optional[User] = Depends(get_current_user)):
    """
    Checks if the authenticated user is active.
    Returns None for unauthenticated requests.
    """
    if current_user is None:
        return None
        
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# Routes

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """
    Returns the current authenticated user's information.
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

@app.post("/chat/initiate")
async def initiate_chat(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_active_user),
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
    
    user_id = current_user.id if current_user else "anonymous"
    
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
        user=current_user
    )

    response = {"success": True, "session_id": session_id}
    
    # Add session-id header for compatibility
    return Response(
        content=json.dumps(response),
        media_type="application/json",
        headers={"session-id": session_id}
    )

async def process_chat_message(session_id: str, user_message: str, user: Optional[User]):
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
        user_id = user.id if user else "anonymous"
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
        if user:
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
    current_user: Optional[User] = Depends(get_current_active_user)
) -> EventSourceResponse:
    """
    Streams the chat response for a given session ID using Redis queues.
    """
    # Check if session exists
    session_data = await session_manager.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check if the user has access to this session
    if current_user and session_data["user_id"] != "anonymous" and session_data["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this session")

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

@app.get("/chat/quiz/{session_id}")
async def get_latest_quiz(
    session_id: str,
    current_user: Optional[User] = Depends(get_current_active_user)
):
    """
    Get the latest quiz generated for a session.
    """
    # Verify the user has access to this session
    if current_user and current_user.id != session_id and session_id != "anonymous":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this quiz"
        )
    
    # Get the latest quiz from Redis
    quiz_key = f"quiz:{session_id}:latest"
    quiz_json = await redis_client.get(quiz_key)
    
    if not quiz_json:
        return {"quiz": None}
    
    try:
        quiz_data = json.loads(quiz_json)
        quiz = Quiz(**quiz_data)
        
        # Clear the quiz from Redis after retrieving it
        await redis_client.delete(quiz_key)
        
        return {"quiz": quiz.dict()}
    except Exception as e:
        print(f"Error parsing quiz data: {e}")
        return {"quiz": None}

@app.get("/chat/history")
async def get_chat_history(current_user: User = Depends(get_current_active_user)):
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access chat history",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
    
@app.post("/quiz/answer")
async def submit_quiz_answer(
    answer: QuizAnswer,
    current_user: User = Depends(get_current_active_user)
):
    """
    Records a user's answer to a quiz question and updates their progress.
    Requires authentication.
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to save quiz answers",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Get current progress from Redis or create new
        progress_key = f"user:{current_user.id}:progress"
        progress_data = await redis_client.get(progress_key)
        
        if progress_data:
            progress = UserProgress.parse_raw(progress_data)
        else:
            progress = UserProgress(user_id=current_user.id)
        
        # Update progress
        progress.total_answers += 1
        if answer.isCorrect:
            progress.correct_answers += 1
            progress.streak += 1
            progress.xp += 10  # Base XP for correct answer
            
            # Bonus XP for streak
            if progress.streak >= 5:
                progress.xp += 5
            if progress.streak >= 10:
                progress.xp += 10
                
            # Level up logic
            if progress.xp >= progress.level * 100:
                progress.level += 1
        else:
            progress.streak = 0
        
        progress.last_answer_time = datetime.now()
        
        # Save updated progress to Redis
        await redis_client.set(progress_key, progress.json())
        
        # Also save this specific answer
        answer_key = f"user:{current_user.id}:answers:{answer.messageId}"
        await redis_client.set(answer_key, json.dumps({
            "optionId": answer.optionId,
            "isCorrect": answer.isCorrect,
            "timestamp": datetime.now().isoformat()
        }))
        
        return {
            "success": True,
            "progress": progress.dict(),
            "message": "Answer recorded successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record answer: {str(e)}")

@app.get("/user/progress")
async def get_user_progress(current_user: User = Depends(get_current_active_user)):
    """
    Returns the user's learning progress.
    Requires authentication.
    """
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access progress",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        progress_key = f"user:{current_user.id}:progress"
        progress_data = await redis_client.get(progress_key)
        
        if progress_data:
            progress = UserProgress.parse_raw(progress_data)
            return progress.dict()
        else:
            return UserProgress(user_id=current_user.id).dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve progress: {str(e)}")
    

# More helper functions
def generate_quiz_for_topic(topic: str, graph, session_id, previous_messages) -> Quiz:
    """
    Generates a quiz for the given topic.
    Replace this with your actual quiz generation logic.
    """

    json_format = '{"question": "question", "options": [{"id": "1", "text": "First possible answer", "isCorrect": false}, {"id": "2", "text": "Second possible answer", "isCorrect": true}, {"id": "3", "text": "Third possible answer", "isCorrect": false}, {"id": "4", "text": "Fourth possible answer", "isCorrect": false}], "explanation": ""}'
    message = f"Based on this text from the user, text:'{topic}', generate a multipe choice quiz in the json format {json_format}. Use the textbook to generate this quiz and only return the json quiz object. If the text field is not relevant to generate a quiz, use previous messages from the user"
    previous_messages.append(HumanMessage(content=message))
    reply = ""
    for event in graph.stream(
        {"messages": previous_messages},
        {"configurable": {"thread_id": session_id}}
    ):
        for value in event.values():
            reply = value["messages"][-1].content

        # Extract the JSON string
    json_match = re.search(r'\`\`\`json\s*({.*?})\s*\`\`\`', reply, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        json_str = reply  # fallback in case it's not wrapped in \`\`\`json \`\`\`

    try:
        quiz_data = json.loads(json_str)
        quiz = Quiz(
            question=quiz_data["question"],
            options=[
                QuizOption(id=opt["id"], text=opt["text"], isCorrect=opt["isCorrect"])
                for opt in quiz_data["options"]
            ],
            explanation=quiz_data["explanation"]
        )
        return quiz
    except Exception as e:
        print(f"Failed to parse or construct quiz: {e}")

async def update_user_progress(user_id: str, topic: str, is_correct: bool):
    """
    Updates the user's progress in Redis.
    """
    try:
        # Get current progress
        progress_key = f"user:{user_id}:progress"
        progress_data = await redis_client.get(progress_key)
        
        if progress_data:
            progress = UserProgress.parse_raw(progress_data)
        else:
            progress = UserProgress(user_id=user_id)
        
        # Update progress
        if is_correct:
            # Track mastered topics
            if topic not in progress.topics_mastered:
                topic_correct_key = f"user:{user_id}:topic:{topic}:correct"
                topic_correct = await redis_client.incr(topic_correct_key)
                
                if topic_correct >= 3:  # Consider a topic mastered after 3 correct answers
                    progress.topics_mastered.append(topic)
        
        # Save updated progress
        await redis_client.set(progress_key, progress.json())
    except Exception as e:
        print(f"Error updating progress: {e}")

@app.get("/api/pdf/{textbook}/{chapter}")
async def get_pdf(textbook: str, chapter: int):
    """Serve a PDF file for a specific textbook chapter."""
    # Construct the file path
    file_path = os.path.join(PDF_DIR, textbook, f"chapter{chapter}.pdf")
    
    logger.info(f"Attempting to serve PDF: {file_path}")
    
    # Check if the file exists
    if not os.path.isfile(file_path):
        logger.error(f"PDF file not found: {file_path}")
        raise HTTPException(status_code=404, detail=f"PDF file not found: {file_path}")
    
    # Return the file
    return FileResponse(
        file_path, 
        media_type="application/pdf",
        filename=f"{textbook}_chapter{chapter}.pdf"
    )

@app.get("/api/chapters/{textbook}", response_model=TextbookInfo)
async def get_chapters(textbook: str, title: Optional[str] = Query(None)):
    """Get available chapters for a textbook."""
    textbook_dir = os.path.join(PDF_DIR, textbook)
    
    logger.info(f"Looking for chapters in: {textbook_dir}")
    
    # Check if the directory exists
    if not os.path.isdir(textbook_dir):
        logger.error(f"Textbook directory not found: {textbook_dir}")
        raise HTTPException(status_code=404, detail=f"Textbook not found: {textbook}")
    
    # Find all chapter PDFs
    chapters = []
    try:
        for file in os.listdir(textbook_dir):
            if file.startswith("chapter") and file.endswith(".pdf"):
                # Extract chapter number and create chapter object
                try:
                    chapter_num = int(file.replace("chapter", "").replace(".pdf", ""))
                    chapter_title = f"Chapter {chapter_num}"
                    
                    # You could read the PDF to extract actual titles if needed
                    if chapter_num == 1:
                        chapter_title = "Introduction"
                    elif chapter_num == 2:
                        chapter_title = "Basic Concepts"
                    elif chapter_num == 3:
                        chapter_title = "Advanced Topics"
                    elif chapter_num == 4:
                        chapter_title = "Case Studies"
                    elif chapter_num == 5:
                        chapter_title = "Practical Applications"
                    elif chapter_num == 6:
                        chapter_title = "Future Directions"
                    
                    chapters.append({
                        "id": chapter_num,
                        "title": chapter_title,
                        "file": f"/api/pdf/{textbook}/{chapter_num}"
                    })
                except ValueError:
                    # Skip files that don't match the expected pattern
                    logger.warning(f"Skipping file with unexpected format: {file}")
                    continue
    except Exception as e:
        logger.error(f"Error reading directory {textbook_dir}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading textbook directory: {str(e)}")
    
    # Sort chapters by ID
    chapters.sort(key=lambda x: x["id"])
    
    # Use provided title or default
    textbook_title = title or f"{textbook} Textbook"
    
    return {
        "id": textbook,
        "title": textbook_title,
        "chapters": chapters
    }

@app.get("/api/textbooks", response_model=List[TextbookInfo])
async def get_textbooks():
    """Get all available textbooks."""
    textbooks = []
    
    try:
        # List all directories in the PDF_DIR
        for item in os.listdir(PDF_DIR):
            dir_path = os.path.join(PDF_DIR, item)
            if os.path.isdir(dir_path):
                # Check if directory contains PDF files
                has_pdfs = any(file.endswith('.pdf') for file in os.listdir(dir_path))
                if has_pdfs:
                    # Get chapters for this textbook
                    try:
                        textbook_info = await get_chapters(item, f"{item} Textbook")
                        textbooks.append(textbook_info)
                    except HTTPException:
                        # Skip textbooks that cause errors
                        continue
    except Exception as e:
        logger.error(f"Error listing textbooks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing textbooks: {str(e)}")
    
    return textbooks

# For debugging purposes
@app.get("/api/debug/file-exists")
async def check_file_exists(path: str):
    """Check if a file exists (for debugging)."""
    full_path = os.path.join(PDF_DIR, path)
    exists = os.path.isfile(full_path)
    return {
        "path": full_path,
        "exists": exists,
        "is_readable": os.access(full_path, os.R_OK) if exists else False
    }

# For debugging purposes
@app.get("/api/debug/list-dir")
async def list_directory(path: str = ""):
    """List contents of a directory (for debugging)."""
    full_path = os.path.join(PDF_DIR, path)
    if not os.path.isdir(full_path):
        raise HTTPException(status_code=404, detail=f"Directory not found: {full_path}")
    
    items = []
    for item in os.listdir(full_path):
        item_path = os.path.join(full_path, item)
        items.append({
            "name": item,
            "is_dir": os.path.isdir(item_path),
            "size": os.path.getsize(item_path) if os.path.isfile(item_path) else None
        })
    
    return {
        "path": full_path,
        "items": items
    }

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

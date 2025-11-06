import json
import uuid
import hashlib
import time
from datetime import datetime, date
from typing import Optional, AsyncGenerator, List, Dict

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
from backend.features.student_context.service import (
    get_student_context_summary,
    increment_chat_interaction,
    get_student_context
)
from backend.features.learning_plan.service import (
    get_or_generate_learning_plan,
    analyze_learning_from_conversation,
    update_student_progress_from_analysis
)
from backend.features.logging.service import ChatLogger


router = APIRouter()

# Logger setup
logger = logging.getLogger(__name__)

# ----------------------------
# Detailed Logging Toggle
# ----------------------------
ENABLE_DETAILED_LOGGING = True  # Set to False to disable detailed chat logging


# ----------------------------
# Utility Functions
# ----------------------------
def hash_message(role: str, content: str) -> str:
    """Create a hash of a message for deduplication."""
    message_str = f"{role}:{content}"
    return hashlib.sha256(message_str.encode()).hexdigest()


# ----------------------------
# Mongo Chat Message History
# ----------------------------
class MongoChatMessageHistory:
    def __init__(self, session_id: str, collection_name: str = "chat_messages"):
        self.session_id = session_id
        self.collection_name = collection_name

    async def add_message(self, role: str, content: str) -> None:
        """Add a message to the collection."""
        collection = await get_collection(self.collection_name)
        await collection.insert_one({
            "session_id": self.session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow()
        })

    async def add_message_if_unique(self, role: str, content: str) -> bool:
        """
        Add a message only if it doesn't already exist (deduplicated).
        Returns True if added, False if duplicate.
        """
        collection = await get_collection(self.collection_name)

        # Create hash for this message
        msg_hash = hash_message(role, content)

        # Check if message with this hash already exists
        existing = await collection.find_one({
            "session_id": self.session_id,
            "message_hash": msg_hash
        })

        if existing:
            logger.debug(f"Duplicate message detected, not adding: {content[:50]}...")
            return False

        # Add new message with hash
        await collection.insert_one({
            "session_id": self.session_id,
            "role": role,
            "content": content,
            "message_hash": msg_hash,
            "timestamp": datetime.utcnow()
        })
        logger.debug(f"Added unique message: {content[:50]}...")
        return True

    async def get_messages(self, limit: int = 50) -> List[Dict]:
        """Retrieve messages for this session."""
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
           content="Generate a detailed conversation summary, a one-line title, and decide if the recent messages need to be added to important messages."
       )
       llm_msgs.insert(0, system_prompt)


       summary_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, tags=["summary-updater"], reasoning_effort="low", )


       prompt_content = "\n".join([
           f"{'user' if isinstance(m, HumanMessage) else 'assistant' if isinstance(m, AIMessage) else 'system'}: {m.content}"
           for m in llm_msgs
       ])


       result = await summary_llm.ainvoke(
           f"""
You are an assistant that summarizes conversations and can find detailed important messages.

Return valid JSON with exactly these keys:
- "title": a concise, one-line title summarizing the conversation.
- "summary": a detailed summary of the conversation, including key points, decisions, and outcomes.
- "important_messages": a list of truly important messages. Each message must be an object:
    - "role": either "user" or "assistant"
    - "content": the full, verbatim text of the message.

Guidelines for selecting "important_messages":

1. Only include messages that contain **essential information, insights, or turning points** that should be remembered long-term.
2. Exclude greetings, filler, polite phrases, or temporary procedural messages unless they contain key content.
3. Any message that contains **detailed instructions, structured learning plans, step-by-step guidance, strategies, or decisions** must be included in full, **as one single message**, exactly as it appears. Do not summarize, shorten, or replace it with placeholders like "[detailed plan provided]".
4. User messages that express **commitment, goals, or instructions for the assistant to act on knowledge or plans** are important and should also be included verbatim.
5. Do not split long messages into smaller pieces; each important message should remain intact.
6. Never remove or abbreviate content that contains actionable knowledge or structured guidance.
7. If no messages meet the criteria, return an empty list for "important_messages". DO NOT INCLUDE MESSAGES LIKE 'the sky is blue' or 'i had eggs for breakfat', be intelligent and DONT CLOG THE IMPORTANT MESSAGES STORAGE.
8. Do not include duplicate messages; each important message should be unique. IF ITS ALREADY IN THE IMPORTANT MESSAGES: PROMPT DONT ADD IT AGAIN.

Data:
            {prompt_content}
            """
        )


       try:
           summary_json = json.loads(result.content)
           title = summary_json.get("title", "Chat Session")
           summary = summary_json.get("summary", "")
           important_msgs = summary_json.get("important_messages", None)
       except Exception:
           title = "Chat Session"
           summary = result.content

       # Add important messages with deduplication
       if isinstance(important_msgs, list):
           added_count = 0
           for msg in important_msgs:
                if isinstance(msg, dict) and "role" in msg and "content" in msg:
                    was_added = await important_messages_collection.add_message_if_unique(
                        msg["role"],
                        msg["content"]
                    )
                    if was_added:
                        added_count += 1
           logger.info(f"Added {added_count} new important messages (skipped {len(important_msgs) - added_count} duplicates)")
           
       collection = await get_collection("conversation_summaries")
       await collection.update_one(
           {"session_id": session_id, "user_id": user_id},
           {"$set": {"title": title, "summary": summary, "updated_at": datetime.utcnow()}},
           upsert=True
       )
   except Exception as e:
       print(f"Error updating conversation summary: {e}")




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
# Context Building Helpers
# ----------------------------
async def build_chat_context(
    session_id: str,
    user_id: str,
    textbook_id: Optional[str],
    chapter_id: Optional[str],
    user_message: str,
    chat_logger: Optional[ChatLogger] = None
) -> List[SystemMessage | HumanMessage | AIMessage]:
    """
    Build complete context for LLM including:
    - System prompt
    - Learning plan for chapter
    - Student progress against learning plan
    - Student learning context (quizzes, concepts)
    - Important messages
    - Textbook content
    - Conversation summary
    - Recent messages
    - Current user message
    """
    llm_msgs = [get_system_prompt()]

    # Log system prompt
    if chat_logger:
        chat_logger.add_context_layer("system_prompt", get_system_prompt().content)

    # 1. Add learning plan context (non-blocking check)
    if textbook_id and chapter_id:
        try:
            # Check if learning plan exists (fast lookup - doesn't block on generation)
            collection = await get_collection("chapter_learning_plans")
            existing_plan = await collection.find_one({
                "textbook_id": textbook_id,
                "chapter_id": str(chapter_id)
            })

            if existing_plan:
                # Plan exists, use it
                existing_plan.pop("_id", None)
                from backend.features.learning_plan.models import ChapterLearningPlan
                learning_plan = ChapterLearningPlan(**existing_plan)

                plan_text = f"""
Learning Plan for {learning_plan.title}:
Overview: {learning_plan.overview}

Learning Objectives:
"""
                for obj in learning_plan.objectives:
                    plan_text += f"\n- {obj.concept}: {obj.description}"
                    if obj.sub_goals:
                        plan_text += f"\n  Sub-goals: {', '.join(obj.sub_goals)}"

                plan_text += f"\n\nConversation Milestones:\n"
                for milestone in learning_plan.conversation_milestones:
                    plan_text += f"- {milestone}\n"

                llm_msgs.append(SystemMessage(content=plan_text))
                logger.info("Added learning plan to chat")

                # Log it
                if chat_logger:
                    chat_logger.add_context_layer("learning_plan", plan_text)
            else:
                # No plan exists - don't block chat waiting for generation
                logger.info(f"Learning plan not found for chapter {chapter_id}, chat will proceed without it")

                # Add a simple fallback note
                llm_msgs.append(SystemMessage(
                    content="Note: Focus on helping the student understand the chapter content thoroughly."
                ))

                if chat_logger:
                    chat_logger.add_context_layer("learning_plan", "Not yet generated - using fallback")

        except Exception as e:
            logger.warning(f"Could not load learning plan: {e}")
            if chat_logger:
                chat_logger.add_error(f"Learning plan error: {e}")

    # 2. Add student progress against learning plan
    if textbook_id and chapter_id:
        student_context_obj = await get_student_context(user_id, textbook_id, chapter_id)
        if student_context_obj and student_context_obj.learning_plan_progress:
            progress = student_context_obj.learning_plan_progress

            progress_text = f"""
Student Progress on Learning Plan:
- Completed objectives: {', '.join(progress.get('objectives_completed', [])) or 'None yet'}
- In progress: {', '.join(progress.get('objectives_in_progress', [])) or 'None'}
- Overall progress: {progress.get('overall_progress_percent', 0):.0f}%
"""

            # Add concept mastery details
            concept_mastery = progress.get('concept_mastery', {})
            if concept_mastery:
                progress_text += "\nConcept Mastery:\n"
                for concept, mastery in concept_mastery.items():
                    level = mastery.get('understanding_level', 'unknown')
                    progress_text += f"- {concept}: {level}\n"

            llm_msgs.append(SystemMessage(content=progress_text))
            logger.info("Added student progress to chat")

    # 3. Add student context (quiz performance, concept mastery)
    if textbook_id and chapter_id:
        student_context = await get_student_context_summary(user_id, textbook_id, chapter_id)
        if student_context and student_context != "No prior learning data for this chapter.":
            llm_msgs.append(SystemMessage(
                content=f"Student Learning Profile for this chapter:\n{student_context}"
            ))
            logger.info("Added student context to chat")

    # 2. Add important messages from conversation history
    important_messages_collection = MongoChatMessageHistory(
        session_id=session_id,
        collection_name="important_messages"
    )
    important_msgs = await important_messages_collection.get_messages(limit=20)

    if important_msgs:
        llm_msgs.append(SystemMessage(content="Important messages from previous conversations:"))
        for msg in important_msgs:
            if msg["role"] == "user":
                llm_msgs.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                llm_msgs.append(AIMessage(content=msg["content"]))
        logger.info(f"Added {len(important_msgs)} important messages")

    # 3. Add textbook chapter content
    if textbook_id and chapter_id:
        textbook_text = await get_textbook_context(textbook_id, chapter_id)
        if textbook_text:
            llm_msgs.append(SystemMessage(content=f"Textbook Chapter Content:\n{textbook_text}"))
            logger.info("Added textbook context to chat")

            # Log textbook content (but truncated to avoid huge logs)
            if chat_logger:
                chat_logger.add_context_layer(
                    "textbook_content",
                    f"[Chapter content: {len(textbook_text)} characters - NOT LOGGED TO SAVE SPACE]"
                )

    # 4. Add conversation summary
    collection = await get_collection("conversation_summaries")
    summary_doc = await collection.find_one({"session_id": session_id, "user_id": user_id})
    if summary_doc and summary_doc.get("summary"):
        llm_msgs.append(SystemMessage(
            content=f"Previous Conversation Summary:\n{summary_doc['summary']}"
        ))
        logger.info("Added conversation summary")

    # 5. Add recent message history
    history = MongoChatMessageHistory(session_id=session_id)
    recent_msgs = await history.get_messages(limit=10)

    for msg in recent_msgs:
        if msg["role"] == "user":
            llm_msgs.append(HumanMessage(content=str(msg["content"])))
        elif msg["role"] == "assistant":
            llm_msgs.append(AIMessage(content=str(msg["content"])))

    logger.info(f"Added {len(recent_msgs)} recent messages")

    # 6. Add current user message
    llm_msgs.append(HumanMessage(content=str(user_message)))

    return llm_msgs


async def detect_topic_branch(session_id: str) -> Dict:
    """
    Detect if the conversation has shifted to a new topic.
    Returns decision dict with start_new_chat and suggested_title.
    """
    try:
        detector_llm = ChatOpenAI(
            model="gpt-5-mini",
            temperature=0,
            tags=["branch-detector"],
            reasoning_effort="low"
        )

        history = MongoChatMessageHistory(session_id=session_id)
        recent = await history.get_messages(limit=10)

        conv_text = "\n".join([f"{m['role']}: {m['content']}" for m in recent])

        detector_prompt = (
            'Decide whether the last user message starts a new topic. '
            'Respond ONLY with JSON: {"start_new_chat": true/false, "suggested_title": string}'
            f'\nConversation:\n{conv_text}'
        )

        result = await detector_llm.ainvoke(detector_prompt)
        logger.debug(f"Branch detector response: {result.content}")

        return json.loads(result.content)

    except Exception as e:
        logger.warning(f"Branch detection failed: {e}")
        return {"start_new_chat": False}


async def analyze_and_update_learning_progress(
    user_id: str,
    textbook_id: str,
    chapter_id: str,
    session_id: str
) -> None:
    """
    Background task to analyze learning from conversation and update student progress.
    This is the key function that makes chat contribute to learning plan progress.
    """
    try:
        # Get learning plan
        learning_plan = await get_or_generate_learning_plan(textbook_id, chapter_id)

        # Get recent messages
        history = MongoChatMessageHistory(session_id=session_id)
        recent_messages = await history.get_messages(limit=10)

        # Get current progress
        student_context = await get_student_context(user_id, textbook_id, chapter_id)
        current_progress = None
        if student_context and student_context.learning_plan_progress:
            from backend.features.learning_plan.models import LearningPlanProgress
            current_progress = LearningPlanProgress(**student_context.learning_plan_progress)

        # Analyze what was learned
        analysis = await analyze_learning_from_conversation(
            session_id=session_id,
            recent_messages=recent_messages,
            learning_plan=learning_plan,
            current_progress=current_progress
        )

        logger.info(f"Learning analysis: {analysis.concepts_discussed}, understanding: {analysis.understanding_demonstrated}")

        # Update student progress based on analysis
        if analysis.concepts_discussed or analysis.understanding_demonstrated:
            await update_student_progress_from_analysis(
                user_id=user_id,
                textbook_id=textbook_id,
                chapter_id=chapter_id,
                session_id=session_id,
                analysis=analysis,
                recent_messages=recent_messages
            )

            logger.info(f"Updated learning progress for user {user_id}")

    except Exception as e:
        logger.error(f"Error analyzing learning progress: {e}", exc_info=True)




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


   background_tasks.add_task(update_conversation_summary, user_id, session_id)


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
    """
    Stream chat responses with complete student context.

    Includes:
    - Quiz performance and concept mastery
    - Textbook chapter content
    - Important messages from history
    - Conversation summary
    - Recent messages
    """
    data = await request.json()
    user_message = data.get("message")
    textbook_id = data.get("textbook_id")
    chapter_id = data.get("chapter_id")
    session_id = data.get("session_id")

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Generate new session if none provided
    if not session_id:
        session_id = str(uuid.uuid4())
        logger.info(f"Generated new session ID: {session_id}")

    # Initialize detailed logger (if enabled)
    chat_logger = None
    if ENABLE_DETAILED_LOGGING:
        chat_logger = ChatLogger(
            session_id=session_id,
            user_id=user_id,
            textbook_id=textbook_id,
            chapter_id=chapter_id
        )
        chat_logger.set_user_message(user_message)

    # Save user message
    history = MongoChatMessageHistory(session_id=session_id)
    await history.add_message("user", user_message)
    logger.info(f"Added user message to session {session_id}")

    # Track chat interaction in student context
    if textbook_id and chapter_id:
        background_tasks.add_task(
            increment_chat_interaction,
            user_id,
            textbook_id,
            chapter_id,
            session_id
        )

    async def event_generator() -> AsyncGenerator[str, None]:
        collected_chunks: List[str] = []
        start_time = time.time()

        try:
            # Build complete context with student profile
            llm_msgs = await build_chat_context(
                session_id=session_id,
                user_id=user_id,
                textbook_id=textbook_id,
                chapter_id=chapter_id,
                user_message=user_message,
                chat_logger=chat_logger  # Pass logger
            )

            logger.info(f"Built context with {len(llm_msgs)} messages")

            # Log full context sent to LLM (if logging enabled)
            if chat_logger:
                chat_logger.set_full_context(llm_msgs)

            # Stream LLM response
            llm = ChatOpenAI(
                model="gpt-5-mini",
                temperature=0,
                streaming=True,
                tags=["Chatter"],
                reasoning_effort="minimal"
            )

            # Log LLM call details (if logging enabled)
            if chat_logger:
                chat_logger.set_llm_call_details(
                    model="gpt-5-mini",
                    temperature=0,
                    streaming=True
                )

            async for chunk in llm.astream(llm_msgs):
                if chunk.content:
                    # Handle both string and list content
                    if isinstance(chunk.content, list):
                        text_parts = [
                            item["text"] for item in chunk.content
                            if isinstance(item, dict) and "text" in item
                        ]
                        chunk_text = "".join(text_parts)
                    else:
                        chunk_text = str(chunk.content)

                    collected_chunks.append(chunk_text)
                    yield json.dumps({'text': chunk_text, 'session_id': session_id})

            # Save assistant response
            full_response = "".join(collected_chunks)
            await history.add_message("assistant", full_response)
            response_time = time.time() - start_time
            logger.info(f"Completed response: {len(full_response)} characters in {response_time:.2f}s")

            # Log response (if logging enabled)
            if chat_logger:
                chat_logger.set_assistant_response(full_response)
                chat_logger.llm_call_details.response_time_seconds = response_time

            # Analyze learning progress from this conversation
            if textbook_id and chapter_id:
                # Do analysis synchronously so we can log it
                try:
                    learning_plan = await get_or_generate_learning_plan(textbook_id, chapter_id)
                    recent_messages = await history.get_messages(limit=10)
                    student_context_obj = await get_student_context(user_id, textbook_id, chapter_id)

                    current_progress = None
                    if student_context_obj and student_context_obj.learning_plan_progress:
                        from backend.features.learning_plan.models import LearningPlanProgress
                        current_progress = LearningPlanProgress(**student_context_obj.learning_plan_progress)

                    # Analyze
                    analysis = await analyze_learning_from_conversation(
                        session_id=session_id,
                        recent_messages=recent_messages,
                        learning_plan=learning_plan,
                        current_progress=current_progress
                    )

                    # Log analysis (if logging enabled)
                    if chat_logger:
                        chat_logger.set_learning_analysis(analysis)

                    # Update progress in background
                    if analysis.concepts_discussed or analysis.understanding_demonstrated:
                        background_tasks.add_task(
                            update_student_progress_from_analysis,
                            user_id,
                            textbook_id,
                            chapter_id,
                            session_id,
                            analysis,
                            recent_messages
                        )

                except Exception as e:
                    logger.error(f"Error in learning analysis: {e}")
                    if chat_logger:
                        chat_logger.add_error(f"Learning analysis error: {e}")

            # Update conversation summary in background
            background_tasks.add_task(update_conversation_summary, user_id, session_id)

            # Save detailed log to MongoDB (if logging enabled)
            if chat_logger:
                background_tasks.add_task(chat_logger.save)

            # Detect topic branching
            decision = await detect_topic_branch(session_id)

            if decision.get("start_new_chat"):
                logger.info("Topic branch detected - creating new session")
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

            yield json.dumps({'done': True, 'session_id': session_id})

        except Exception as e:
            logger.error(f"Error in stream_chat: {e}", exc_info=True)
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


# ----------------------------
# GET Detailed Chat Logs (For Debugging/Analysis)
# ----------------------------
@router.get("/logs")
async def get_detailed_chat_logs(
    session_id: Optional[str] = None,
    limit: int = 5,
    user_id: str = Depends(validate_access_token)
):
    """
    Retrieve detailed chat logs with full context, analysis, etc.
    Returns formatted logs ready to copy/paste for analysis.
    """
    from backend.features.logging.service import get_chat_logs

    try:
        formatted_logs = await get_chat_logs(
            user_id=user_id,
            session_id=session_id,
            limit=limit
        )

        return {
            "count": len(formatted_logs),
            "logs": formatted_logs
        }

    except Exception as e:
        logger.error(f"Error retrieving chat logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve logs")
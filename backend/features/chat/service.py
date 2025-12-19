from datetime import datetime, date
from typing import List, Optional, AsyncGenerator, Set, Tuple
import logging
import json
import uuid

from fastapi import HTTPException
from openai.types.chat import ChatCompletionMessageParam

from backend.db.models import ChatMessage, ConversationSummary, ImportantMessage
from backend.features.chat.models import ConversationSummaryUpdate
from backend.features.openai.service import (
    generate_chat_completion,
    generate_chat_completion_stream,
    generate_structured_chat_completion,
    track_stream_completion
)
from backend.features.openai.prompts import chat_prompt
from backend.features.textbooks.service import get_chapter_text

logger = logging.getLogger(__name__)

class ChatService:
    async def add_message(self, session_id: str, role: str, content: str, is_important: bool = False) -> None:
        if is_important:
            await ImportantMessage(
                session_id=session_id,
                role=role,
                content=content,
                timestamp=datetime.utcnow()
            ).insert()
        else:
            await ChatMessage(
                session_id=session_id,
                role=role,
                content=content,
                timestamp=datetime.utcnow()
            ).insert()

    async def get_messages(self, session_id: str, limit: int = 50, is_important: bool = False) -> List[dict]:
        if is_important:
            messages = await ImportantMessage.find(
                ImportantMessage.session_id == session_id
            ).sort("-timestamp").limit(limit).to_list()
        else:
            messages = await ChatMessage.find(
                ChatMessage.session_id == session_id
            ).sort("-timestamp").limit(limit).to_list()
        
        # Sort by timestamp ascending for context
        messages.sort(key=lambda m: m.timestamp)
        return [{"role": m.role, "content": m.content, "timestamp": m.timestamp} for m in messages]

    async def get_textbook_context(self, textbook_id: str, chapter_id: str) -> str:
        try:
            text = await get_chapter_text(textbook_id, chapter_id)
            logger.info(f"Retrieved textbook context for {textbook_id}/chapter{chapter_id}: {len(text)} characters")
            return text
        except Exception as e:
            logger.error(f"Error retrieving textbook context for {textbook_id}/chapter{chapter_id}: {e}")
            return ""

    async def update_conversation_summary(self, user_id: str, session_id: str) -> None:
        try:
            messages = await self.get_messages(session_id, limit=10)
            important_messages = await self.get_messages(session_id, limit=20, is_important=True)

            llm_msgs: List[ChatCompletionMessageParam] = []
            llm_msgs.append({
                "role": "system",
                "content": "Update the conversation summary with new information, and decide if the recent messages need to be added to important messages."
            })

            important_msg_ids: Set[Tuple[str, str, str]] = set()

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
                        msg_id = (msg["role"], msg["content"], str(msg.get("timestamp", "")))
                        important_msg_ids.add(msg_id)

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

            existing_doc = await ConversationSummary.find_one(
                ConversationSummary.session_id == session_id,
                ConversationSummary.user_id == user_id
            )
            existing_title = existing_doc.title if existing_doc else None
            existing_summary = existing_doc.summary if existing_doc else None

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

            completion = generate_structured_chat_completion(
                trace_name="update_conversation_summary",
                model="gpt-4o-mini",
                messages=llm_msgs,
                response_format=ConversationSummaryUpdate,
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

                if important_msgs:
                    for msg in important_msgs:
                        await self.add_message(session_id, msg.role, msg.content, is_important=True)

            if existing_doc:
                existing_doc.title = new_title
                existing_doc.summary = new_summary
                existing_doc.updated_at = datetime.utcnow()
                await existing_doc.save()
            else:
                await ConversationSummary(
                    session_id=session_id,
                    user_id=user_id,
                    title=new_title,
                    summary=new_summary,
                    updated_at=datetime.utcnow()
                ).insert()

        except Exception as e:
            logger.error(f"Error updating conversation summary: {e}")

    async def chat_message(self, user_id: str, session_id: str, user_message: str) -> str:
        await self.add_message(session_id, "user", user_message)
        
        recent_msgs = await self.get_messages(session_id, limit=10)
        llm_msgs: List[ChatCompletionMessageParam] = [{"role": "system", "content": chat_prompt}]
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
        
        await self.add_message(session_id, "assistant", ai_response)
        return ai_response

    async def stream_chat(self, user_id: str, session_id: str, user_message: str, textbook_id: Optional[str], chapter_id: Optional[str]) -> AsyncGenerator[str, None]:
        try:
            recent_msgs = await self.get_messages(session_id, limit=10)
            important_msgs = await self.get_messages(session_id, limit=20, is_important=True)
            
            summary_doc = await ConversationSummary.find_one(
                ConversationSummary.session_id == session_id,
                ConversationSummary.user_id == user_id
            )
            summary_text = summary_doc.summary if summary_doc else ""

            llm_msgs: List[ChatCompletionMessageParam] = [{"role": "system", "content": chat_prompt}]

            important_msg_ids = set()
            if important_msgs:
                llm_msgs.append({"role": "system", "content": "Important messages from the conversation:"})
                for msg in important_msgs:
                    if msg["role"] in ["user", "assistant"]:
                        llm_msgs.append({"role": msg["role"], "content": msg["content"]})
                        msg_id = (msg["role"], msg["content"], str(msg.get("timestamp", "")))
                        important_msg_ids.add(msg_id)

            textbook_text = await self.get_textbook_context(textbook_id, chapter_id) if (textbook_id and chapter_id) else None
            if textbook_text:
                llm_msgs.append({"role": "system", "content": f"Context from textbook:\n{textbook_text}"})
            
            if summary_text:
                llm_msgs.append({"role": "system", "content": f"Conversation Summary:\n{summary_text}"})

            llm_msgs.append({"role": "system", "content": "Recent messages:"})
            for msg in recent_msgs:
                if msg["role"] in ["user", "assistant"]:
                    msg_id = (msg["role"], msg["content"], str(msg.get("timestamp", "")))
                    if msg_id not in important_msg_ids:
                        llm_msgs.append({"role": msg["role"], "content": msg["content"]})

            llm_msgs.append({"role": "user", "content": user_message})

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

            collected_chunks = []
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    collected_chunks.append(content)
                    yield json.dumps({'text': content, 'session_id': session_id})

            full_response = "".join(collected_chunks)

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

            await self.add_message(session_id, "user", user_message)
            await self.add_message(session_id, "assistant", full_response)
            
            yield json.dumps({'done': True, 'session_id': session_id})

        except Exception as e:
            logger.error(f"Error in stream_chat: {e}")
            yield json.dumps({'done': True, 'error': str(e), 'session_id': session_id})

    async def get_chat_history(self, user_id: str, session_id: Optional[str] = None) -> dict:
        if session_id:
            messages = await self.get_messages(session_id, limit=100)
            
            summary_doc = await ConversationSummary.find_one(
                ConversationSummary.session_id == session_id,
                ConversationSummary.user_id == user_id
            )

            # Convert timestamps to ISO strings
            for m in messages:
                if isinstance(m["timestamp"], (datetime, date)):
                    m["timestamp"] = m["timestamp"].isoformat()

            return {
                "session_id": session_id,
                "title": summary_doc.title if summary_doc else "Untitled Chat",
                "summary": summary_doc.summary if summary_doc else "",
                "messages": messages
            }
        else:
            summaries = await ConversationSummary.find(
                ConversationSummary.user_id == user_id
            ).sort("-updated_at").limit(100).to_list()

            chats = []
            for summary in summaries:
                chats.append({
                    "session_id": summary.session_id,
                    "title": summary.title,
                    "summary": summary.summary,
                    "updated_at": summary.updated_at.isoformat() if summary.updated_at else None
                })
            return {"chats": chats}

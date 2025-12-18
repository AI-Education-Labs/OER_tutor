from __future__ import annotations
from beanie import Document
from typing import List, Dict, Optional

from typing import Literal
from datetime import datetime

# Chat models and collections
class ChatMessage(Document):
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime

    class Settings:
        name = "chat_messages"

class ConversationSummary(Document):
    session_id: str
    summary: str
    title: str
    updated_at: datetime
    user_id: str

    class Settings:
        name = "conversation_summaries"

class ImportantMessage(Document):
    content: str
    role: str # some mis-spellings using capitalized Assistant and User for 3$ of messages
    session_id: str
    timestamp: datetime

    class Settings:
        name = "important_messages"

class Textbook(Document):
    title: str
    subject: str
    code: str
    author: str
    chapters: List[Chapter]
    cover: str
    filepath: str
    source: str
    updated_at: str #TODO: this should be `datetime`
    
    class Settings:
        name = "textbooks"
    
class Chapter:
    id: int
    title: str
    startPage: int
    sub_chapters: List[SubChapter]
    file: str
    
class SubChapter:
    title: str
    pageOffset: int
    

class UserBook(Document):
    textbooks: List[str]
    
    class Settings:
        name = "user_books"

class UserFlashcard(Document):
    chapter: str
    createdTime: str #TODO: this is a unix timestamp. it should be `datetime`
    flashcard: Flashcard
    hint: str
    textbook_id: str
    user: str # user id

    class Settings:
        name = "user_flashcards"

class Flashcard:
    flashcards_front: List[str]
    flashcards_back: List[str]

class LastVisit:
    chapter: int
    page: int

class TextbookProgress:
    total_progress: int
    chapters: Dict[str, int]
    last_visit: LastVisit

class UserProgress(Document):
    textbook_progress: Dict[str, TextbookProgress]

    class Settings:
        name = "user_progress"

class UserQuiz(Document):
    user: str  # user id
    quiz: List[QuizQuestion]
    created_time: int  # TODO: this is a unix timestamp. it should be `datetime`
    hint: str
    quiz_result: Dict = {}  # empty dict by default, populated after quiz completion
    textbook_id: str
    chapter: str

    class Settings:
        name = "user_quizzes"

class QuizQuestion:
    question: str
    choices: List[str]
    answer: int

class User(Document):
    username: str
    email: str
    user_id: Optional[str] = None  # TODO: redundant with MongoDB's _id, consider removing
    disabled: int = 0  # 0 for active, 1 for disabled
    hashed_password: str

    class Settings:
        name = "users"

        # LEFTOFF: last copied mongodb compass schema into here. Next up is re-implement everything using beanie for ODM functionality. it should be in database.py, and then with plans to migrate it directly into repo.py for each feature for abstracting fetching.
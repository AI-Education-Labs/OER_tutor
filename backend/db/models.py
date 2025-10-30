from beanie import Document
from datetime import datetime
from backend.features.quiz.models import GeneratedQuiz
from backend.features.flashcards.models import FlashcardDeck
from typing import Optional

from pydantic import BaseModel, Field

# user Document
class BookProgress(BaseModel):
    last_read_page: int = Field(..., description="The last page the user read")
    chapters: dict[int, int] = Field(..., description="Mapping of chapter indices to percentage done of chapter")
    last_visited_chapter: int = Field(..., description="Last visited chapter index")
    last_visited_page: int = Field(..., description="Last visited page within the chapter")

class User(Document):
    username: str = Field(..., description="Username of the user")
    email: str = Field(..., description="Email address of the user")
    hashed_password: str = Field(..., description="Hashed password of the user")
    books: list[str] = Field(default_factory=list, description="List of textbook IDs associated with the user")
    book_progress: dict = Field(default_factory=dict, description="Mapping of textbook IDs to user's progress data")

    class Settings:
        name = "users"


# Textbook Document
class Section(BaseModel):
    title: str = Field(..., description="Title of the section")
    page_offset: int = Field(..., description="Page offset in the pdf")

class Chapter(BaseModel):
    id: int = Field(..., description="Identifier for the chapter")
    title: str = Field(..., description="Title of the chapter")
    file: str = Field(..., description="File associated with the chapter")
    start_page: int = Field(..., description="Starting page number of the chapter")
    sections: list[Section] = Field(..., description="List of sections within the chapter")

class Textbook(Document):
    author: str = Field(..., description="Author of the textbook")
    title: str = Field(..., description="Title of the textbook")
    subject: str = Field(..., description="Subject of the textbook")
    code: str = Field(..., description="Code of the textbook")  # to add it to your books
    chapters: list[Chapter] = Field(..., description="List of chapters in the textbook")
    cover_url: str = Field(..., description="URL of the textbook cover image")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "textbooks"

# Conversations Document
class ConversationItem(BaseModel):
    role: str = Field(..., description="Role of the message sender (e.g., user, tutor, system)")
    content: str = Field(..., description="Content of the chat message")
    timestamp: datetime = Field(..., description="Timestamp of when the message was sent")

class UserConversation(Document):
    user_uuid: str = Field(..., description="UUID of the user")
    conversation: list[ConversationItem] = Field(..., description="List of conversation items between the user and the tutor")
    conversation_title: str = Field(..., description="A title for the conversation")
    conversation_summary: str = Field(..., description="A brief summary of the conversation")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    class Settings:
        name = "user_conversations"

# Quiz Document
class UserQuiz(Document):
    user_uuid: str = Field(..., description="UUID of the user")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Timestamp when the quiz was created")
    quiz: GeneratedQuiz = Field(..., description="")
    #TODO: not implmented in frontend, not implemented here. quiz_result: Optional[dict] = Field(default=None, description="Results of the quiz taken by the user") #TODO: type this when implemented
    quiz_result: dict = Field(description="Results of the quiz taken by the user") #TODO: type this when implemented
    textbook_id: str = Field(..., description="Identifier for the textbook quiz is associated with")
    chapter: int = Field(..., description="Chapter of the textbook quiz is associated with")
    class Settings:
        name = "user_quizzes"

# Flashcards Document
class UserFlashcards(Document):
    user_uuid: str = Field(..., description="UUID of the user")
    textbook_id: str = Field(..., description="Identifier for the textbook flashcards are associated with")
    chapter: int = Field(..., description="Chapter of the textbook flashcards are associated with")
    flashcards: FlashcardDeck = Field(..., description="The flashcard deck data")
    hint: Optional[str] = Field(default=None, description="The hint provided for generating the flashcard")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="The creation time of the flashcard deck")

    class Settings:
        name = "user_flashcards"
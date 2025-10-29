from pydantic import BaseModel, Field
from typing import Optional, List

class FlashcardDeck(BaseModel):
    flashcards_front: List[str] = Field(description="A list of keywords, terms, or condensed concepts, the front of the flashcard")
    flashcards_back: List[str] = Field(description="A list of defintions, explanations, answers, the back of the flashcard")

class FlashcardRequest(BaseModel):
    context: str
    textbook_id: str
    chapter: str
    num_flashcards: int = 5
    hint: Optional[str] = None

class ListResponse(BaseModel):
    deck: FlashcardDeck = Field(description="The flashcard deck data")
    created_time: str = Field(description="The creation time of the flashcard deck")

class FlashcardModal(BaseModel):
    id: str = Field(description="The uuid for the flashcard deck")
    user: str = Field(description="The user uuid for the owner of the flashcard deck")
    flashcard: FlashcardDeck = Field(description="The flashcard deck data")
    created_time: int = Field(description="The unix timestamp for when the flashcard deck was created")
    hint: Optional[str] = Field(description="The hint provided for generating the flashcard")
    textbook_id: str = Field(description="The textbook id associated with the flashcard deck")
    chapter: str = Field(description="The chapter associated with the flashcard deck")

class DeleteResponse(BaseModel):
    detail: str = Field(description="Detail message about the deletion status")

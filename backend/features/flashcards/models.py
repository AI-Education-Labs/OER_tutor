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
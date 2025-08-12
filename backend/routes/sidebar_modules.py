from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class Module(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None


@router.get("/health")
async def health() -> dict:
    return {"ok": True}


@router.get("/modules", response_model=List[Module])
async def list_modules() -> List[Module]:
    """
    Return the set of sidebar modules/features available in the UI. Replace the
    hardcoded list later with dynamic configuration or persistence.
    """
    try:
        return [
            Module(id="chat", title="Chat", description="Ask questions and get answers", icon="message-square"),
            Module(id="quiz", title="Quiz", description="Practice with generated quizzes", icon="help-circle"),
            Module(id="notes", title="Notes", description="Save important insights", icon="bookmark"),
            Module(id="progress", title="Progress", description="Track your learning progress", icon="bar-chart-2"),
            Module(id="textbooks", title="Textbooks", description="Browse available books", icon="book-open"),
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load modules: {exc}")



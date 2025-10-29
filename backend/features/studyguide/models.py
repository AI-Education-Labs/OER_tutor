from pydantic import BaseModel, Field
from typing import Optional

class StudyGuide(BaseModel):
    study_guide: str = Field(description="A study guide for the student to review their material")

class StudyGuideRequest(BaseModel):
    context: str
    textbook_id: str
    chapter: str
    hint: Optional[str] = None
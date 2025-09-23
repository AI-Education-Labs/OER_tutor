from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime

class ChapterProgress(BaseModel):
    completed: bool = False
    progress: float = 0.0  # % of the chapter completed
    time_started: Optional[datetime] = None
    time_completed: Optional[datetime] = None
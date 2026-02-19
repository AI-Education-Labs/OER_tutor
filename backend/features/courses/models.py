from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class Course(BaseModel):
    # Mongo stores the primary key as `_id`, but the API and frontend use `id`.
    id: str = Field(validation_alias="_id", serialization_alias="id")
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    view_type: str  # "public" | "private"
    invite_code: Optional[str] = None  # auto-generated 6-char, present when private
    instructor_id: str
    instructor_name: str
    textbooks: List[str] = []  # list of textbook IDs
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    view_type: str  # "public" | "private"
    instructor_name: str
    textbooks: List[str] = []


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    view_type: Optional[str] = None
    instructor_name: Optional[str] = None


class Enrollment(BaseModel):
    id: str = Field(validation_alias="_id", serialization_alias="id")
    course_id: str
    user_id: str
    enrolled_at: datetime

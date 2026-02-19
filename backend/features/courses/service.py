import logging
import string
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from backend.features.courses.models import CourseCreate
from backend.features.courses import repo

logger = logging.getLogger(__name__)


def generate_invite_code(length: int = 6) -> str:
    """Generate a random alphanumeric invite code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


async def create_course(course_data: CourseCreate, instructor_id: str) -> Dict[str, Any]:
    """Build a course document, persist it, and return the parsed Course."""
    course_id = str(uuid.uuid4())

    invite_code = None
    if course_data.view_type == "private":
        invite_code = generate_invite_code()

    now = datetime.now(timezone.utc)
    doc: Dict[str, Any] = {
        "_id": course_id,
        "title": course_data.title,
        "description": course_data.description,
        "subject": course_data.subject,
        "view_type": course_data.view_type,
        "invite_code": invite_code,
        "instructor_id": instructor_id,
        "instructor_name": course_data.instructor_name,
        "textbooks": course_data.textbooks,
        "created_at": now,
        "updated_at": now,
    }

    course = await repo.create_course(doc)
    return course

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from pydantic import BaseModel
import logging

from backend.features.courses.models import Course, CourseCreate, CourseUpdate
from backend.features.courses import repo
from backend.features.courses.service import create_course as service_create_course
from backend.features.auth.service import validate_access_token, validate_access_token_optional
from backend.features.textbooks.repo import find_textbooks_by_ids
from backend.db.database import get_user_by_id

router = APIRouter()
logger = logging.getLogger(__name__)


async def _attach_cover_urls(courses_data: list) -> None:
    """Batch-fetch the first textbook's cover for each course and attach it."""
    first_tb_ids = set()
    for d in courses_data:
        tbs = d.get("textbooks", [])
        if tbs:
            first_tb_ids.add(tbs[0])

    cover_map: dict[str, Optional[str]] = {}
    if first_tb_ids:
        textbooks = await find_textbooks_by_ids(list(first_tb_ids))
        cover_map = {tb.id: tb.cover for tb in textbooks}

    for d in courses_data:
        tbs = d.get("textbooks", [])
        d["cover_url"] = cover_map.get(tbs[0]) if tbs else None


# ── Helper: verify the caller is a professor ─────────────────────────────

async def _require_professor(user_id: str) -> dict:
    user = await get_user_by_id(user_id)
    if not user or user.get("role") != "professor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only professors can perform this action")
    return user


async def _require_course_owner(course_id: str, user_id: str) -> Course:
    """Return the course if the user is its instructor, else 403."""
    course = await repo.find_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.instructor_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the owner of this course")
    return course


# ── Response models ───────────────────────────────────────────────────────

class CourseListResponse(BaseModel):
    courses: list
    count: int


class JoinRequest(BaseModel):
    code: str


class TextbookAddRequest(BaseModel):
    textbook_id: str


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_course(payload: CourseCreate, user_id: str = Depends(validate_access_token)):
    """Create a new course. Requires professor role."""
    await _require_professor(user_id)

    if payload.view_type not in ("public", "private"):
        raise HTTPException(status_code=400, detail="view_type must be 'public' or 'private'")

    course = await service_create_course(payload, user_id)
    enrollment_count = await repo.get_enrollment_count(course.id, exclude_user_id=user_id)
    course_dict = course.model_dump(by_alias=True)
    course_dict["student_count"] = enrollment_count
    return course_dict


@router.get("/list")
async def list_public_courses(user_id: str = Depends(validate_access_token_optional)):
    """List all public courses for browsing."""
    courses = await repo.find_courses_public()
    result = []
    for c in courses:
        d = c.model_dump(by_alias=True)
        d["student_count"] = await repo.get_enrollment_count(c.id, exclude_user_id=c.instructor_id)
        d["textbook_count"] = len(c.textbooks)
        if user_id:
            d["is_enrolled"] = await repo.is_enrolled(c.id, user_id)
            d["is_owner"] = c.instructor_id == user_id
        else:
            d["is_enrolled"] = False
            d["is_owner"] = False
        result.append(d)
    await _attach_cover_urls(result)
    return {"courses": result, "count": len(result)}


@router.get("/my-courses")
async def get_my_courses(user_id: str = Depends(validate_access_token)):
    """Return courses the user is enrolled in (students) or owns (professors)."""
    user = await get_user_by_id(user_id)
    role = user.get("role", "student") if user else "student"

    owned = []
    enrolled_courses = []

    if role == "professor":
        owned = await repo.find_courses_by_instructor(user_id)

    enrolled_ids = await repo.get_enrollments_by_user(user_id)
    if enrolled_ids:
        enrolled_courses = await repo.find_courses_by_ids(enrolled_ids)

    # Merge owned + enrolled, deduplicate
    seen = set()
    result = []
    for c in owned + enrolled_courses:
        if c.id in seen:
            continue
        seen.add(c.id)
        d = c.model_dump(by_alias=True)
        d["student_count"] = await repo.get_enrollment_count(c.id, exclude_user_id=c.instructor_id)
        d["textbook_count"] = len(c.textbooks)
        d["is_enrolled"] = await repo.is_enrolled(c.id, user_id)
        d["is_owner"] = c.instructor_id == user_id
        result.append(d)

    await _attach_cover_urls(result)
    return {"courses": result, "count": len(result)}


@router.get("/{course_id}")
async def get_course(course_id: str, user_id: str = Depends(validate_access_token_optional)):
    """Get course details, including enrollment status for the caller."""
    course = await repo.find_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    d = course.model_dump(by_alias=True)
    d["student_count"] = await repo.get_enrollment_count(course.id, exclude_user_id=course.instructor_id)
    d["textbook_count"] = len(course.textbooks)
    if user_id:
        d["is_enrolled"] = await repo.is_enrolled(course.id, user_id)
        d["is_owner"] = course.instructor_id == user_id
    else:
        d["is_enrolled"] = False
        d["is_owner"] = False
    await _attach_cover_urls([d])
    return d


@router.patch("/{course_id}")
async def update_course(course_id: str, payload: CourseUpdate, user_id: str = Depends(validate_access_token)):
    """Update course info. Only the course owner (professor) can update."""
    await _require_course_owner(course_id, user_id)
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "view_type" in update_data and update_data["view_type"] not in ("public", "private"):
        raise HTTPException(status_code=400, detail="view_type must be 'public' or 'private'")

    course = await repo.update_course(course_id, update_data)
    return course.model_dump(by_alias=True)


@router.post("/{course_id}/enroll")
async def enroll_in_course(course_id: str, user_id: str = Depends(validate_access_token)):
    """Enroll the authenticated user in a public course."""
    course = await repo.find_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.view_type != "public":
        raise HTTPException(status_code=403, detail="This course requires an invite code")

    already = await repo.is_enrolled(course_id, user_id)
    if already:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")

    enrollment = await repo.enroll_user(course_id, user_id)
    return {"ok": True, "enrollment": enrollment.model_dump(by_alias=True)}


@router.post("/join")
async def join_by_invite_code(payload: JoinRequest, user_id: str = Depends(validate_access_token)):
    """Join a private course using a 6-character invite code."""
    code = (payload.code or "").strip().upper()
    if len(code) != 6:
        raise HTTPException(status_code=400, detail="Invite code must be 6 characters")

    course = await repo.find_course_by_invite_code(code)
    if not course:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    already = await repo.is_enrolled(course.id, user_id)
    if already:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")

    enrollment = await repo.enroll_user(course.id, user_id)
    return {
        "ok": True,
        "course_id": course.id,
        "course_title": course.title,
        "enrollment": enrollment.model_dump(by_alias=True),
    }


@router.delete("/{course_id}/unenroll")
async def unenroll_from_course(course_id: str, user_id: str = Depends(validate_access_token)):
    """Leave a course. Professors cannot unenroll from their own courses."""
    course = await repo.find_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.instructor_id == user_id:
        raise HTTPException(status_code=400, detail="Instructors cannot unenroll from their own course")

    removed = await repo.unenroll_user(course_id, user_id)
    if not removed:
        raise HTTPException(status_code=400, detail="Not enrolled in this course")
    return {"ok": True}


# ── Textbook management on a course ──────────────────────────────────────

@router.post("/{course_id}/textbooks")
async def add_textbook_to_course(course_id: str, payload: TextbookAddRequest, user_id: str = Depends(validate_access_token)):
    """Add a textbook to the course. Professor (owner) only."""
    await _require_course_owner(course_id, user_id)
    course = await repo.add_textbook_to_course(course_id, payload.textbook_id)
    return course.model_dump(by_alias=True)


@router.delete("/{course_id}/textbooks/{textbook_id}")
async def remove_textbook_from_course(course_id: str, textbook_id: str, user_id: str = Depends(validate_access_token)):
    """Remove a textbook from the course. Professor (owner) only."""
    await _require_course_owner(course_id, user_id)
    course = await repo.remove_textbook_from_course(course_id, textbook_id)
    return course.model_dump(by_alias=True)


# ── Enrolled students list ───────────────────────────────────────────────

@router.get("/{course_id}/students")
async def list_enrolled_students(course_id: str, user_id: str = Depends(validate_access_token)):
    """List enrolled students. Professor (owner) only."""
    await _require_course_owner(course_id, user_id)
    student_ids = await repo.get_enrollments_by_course(course_id)
    students = []
    for sid in student_ids:
        u = await get_user_by_id(sid)
        if u:
            students.append({
                "id": u.get("_id") or u.get("id"),
                "username": u.get("username"),
                "email": u.get("email"),
                "role": u.get("role"),
            })
    return {"students": students, "count": len(students)}

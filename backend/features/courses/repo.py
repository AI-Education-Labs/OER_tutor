from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from backend.db.database import get_collection
from backend.features.courses.models import Course, Enrollment


COURSES_COLLECTION = "courses"
ENROLLMENTS_COLLECTION = "enrollments"


def _parse_course(doc: Dict[str, Any]) -> Course:
    return Course.model_validate(doc)


def _parse_enrollment(doc: Dict[str, Any]) -> Enrollment:
    return Enrollment.model_validate(doc)


# ── Course Repository ────────────────────────────────────────────────────

async def create_course(course_doc: Dict[str, Any]) -> Course:
    collection = await get_collection(COURSES_COLLECTION)
    await collection.insert_one(course_doc)
    return _parse_course(course_doc)


async def find_course_by_id(course_id: str) -> Optional[Course]:
    collection = await get_collection(COURSES_COLLECTION)
    doc = await collection.find_one({"_id": course_id})
    if not doc:
        return None
    return _parse_course(doc)


async def find_courses_public(skip: int = 0, limit: int = 50) -> List[Course]:
    collection = await get_collection(COURSES_COLLECTION)
    cursor = collection.find({"view_type": "public"}).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [_parse_course(d) for d in docs]


async def find_courses_by_instructor(instructor_id: str) -> List[Course]:
    collection = await get_collection(COURSES_COLLECTION)
    cursor = collection.find({"instructor_id": instructor_id})
    docs = await cursor.to_list(length=200)
    return [_parse_course(d) for d in docs]


async def find_course_by_invite_code(code: str) -> Optional[Course]:
    collection = await get_collection(COURSES_COLLECTION)
    doc = await collection.find_one({"invite_code": code})
    if not doc:
        return None
    return _parse_course(doc)


async def update_course(course_id: str, update_data: Dict[str, Any]) -> Optional[Course]:
    collection = await get_collection(COURSES_COLLECTION)
    update_data["updated_at"] = datetime.now(timezone.utc)
    await collection.update_one({"_id": course_id}, {"$set": update_data})
    return await find_course_by_id(course_id)


async def add_textbook_to_course(course_id: str, textbook_id: str) -> Optional[Course]:
    collection = await get_collection(COURSES_COLLECTION)
    await collection.update_one(
        {"_id": course_id},
        {
            "$addToSet": {"textbooks": textbook_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )
    return await find_course_by_id(course_id)


async def remove_textbook_from_course(course_id: str, textbook_id: str) -> Optional[Course]:
    collection = await get_collection(COURSES_COLLECTION)
    await collection.update_one(
        {"_id": course_id},
        {
            "$pull": {"textbooks": textbook_id},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )
    return await find_course_by_id(course_id)


async def find_courses_by_ids(course_ids: List[str]) -> List[Course]:
    if not course_ids:
        return []
    collection = await get_collection(COURSES_COLLECTION)
    cursor = collection.find({"_id": {"$in": course_ids}})
    docs = await cursor.to_list(length=len(course_ids))
    by_id = {}
    for doc in docs:
        try:
            c = _parse_course(doc)
            by_id[c.id] = c
        except Exception:
            continue
    return [by_id[cid] for cid in course_ids if cid in by_id]


# ── Enrollment Repository ────────────────────────────────────────────────

async def enroll_user(course_id: str, user_id: str) -> Enrollment:
    collection = await get_collection(ENROLLMENTS_COLLECTION)
    enrollment_id = f"{course_id}_{user_id}"
    doc = {
        "_id": enrollment_id,
        "course_id": course_id,
        "user_id": user_id,
        "enrolled_at": datetime.now(timezone.utc),
    }
    await collection.update_one(
        {"_id": enrollment_id},
        {"$setOnInsert": doc},
        upsert=True,
    )
    return _parse_enrollment(doc)


async def unenroll_user(course_id: str, user_id: str) -> bool:
    collection = await get_collection(ENROLLMENTS_COLLECTION)
    enrollment_id = f"{course_id}_{user_id}"
    result = await collection.delete_one({"_id": enrollment_id})
    return result.deleted_count > 0


async def get_enrollments_by_user(user_id: str) -> List[str]:
    """Return list of course IDs the user is enrolled in."""
    collection = await get_collection(ENROLLMENTS_COLLECTION)
    cursor = collection.find({"user_id": user_id}, {"course_id": 1})
    docs = await cursor.to_list(length=500)
    return [d["course_id"] for d in docs]


async def get_enrollments_by_course(course_id: str) -> List[str]:
    """Return list of user IDs enrolled in the course."""
    collection = await get_collection(ENROLLMENTS_COLLECTION)
    cursor = collection.find({"course_id": course_id}, {"user_id": 1})
    docs = await cursor.to_list(length=5000)
    return [d["user_id"] for d in docs]


async def get_enrollment_count(course_id: str, exclude_user_id: str | None = None) -> int:
    query: dict = {"course_id": course_id}
    if exclude_user_id:
        query["user_id"] = {"$ne": exclude_user_id}
    collection = await get_collection(ENROLLMENTS_COLLECTION)
    return await collection.count_documents(query)


async def is_enrolled(course_id: str, user_id: str) -> bool:
    collection = await get_collection(ENROLLMENTS_COLLECTION)
    enrollment_id = f"{course_id}_{user_id}"
    doc = await collection.find_one({"_id": enrollment_id})
    return doc is not None

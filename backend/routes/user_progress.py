import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.db.database import get_collection, get_document
from backend.features.auth.service import validate_access_token

logger = logging.getLogger(__name__)

router = APIRouter()


class LastVisit(BaseModel):
    chapter: int = Field(..., description="Last visited chapter id (numeric)")
    page: int = Field(..., description="Last visited page number (1-based)")


class TextbookProgress(BaseModel):
    total_progress: float = 0
    chapters: Dict[str, float] = Field(default_factory=dict)
    last_visit: Optional[LastVisit] = None


class UserProgress(BaseModel):
    id: str = Field(alias="_id")
    textbook_progress: Dict[str, TextbookProgress] = Field(default_factory=dict)


async def _get_user_progress_doc(user_id: str) -> Optional[Dict[str, Any]]:
    return await get_document("user_progress", user_id)


async def _ensure_user_progress_doc(user_id: str) -> Dict[str, Any]:
    collection = await get_collection("user_progress")
    existing = await collection.find_one({"_id": user_id})
    if existing:
        return existing
    doc = {"_id": user_id, "textbook_progress": {}}
    await collection.insert_one(doc)
    return doc

async def _ensure_textbook_progress_subdoc(user_id: str, textbook_id: str) -> None:
    """Ensure the textbook subdocument exists to avoid parent/child path conflicts in a single update."""
    collection = await get_collection("user_progress")
    await _ensure_user_progress_doc(user_id)
    await collection.update_one(
        {"_id": user_id, f"textbook_progress.{textbook_id}": {"$exists": False}},
        {"$set": {f"textbook_progress.{textbook_id}": {"total_progress": 0, "chapters": {}, "last_visit": None}}},
        upsert=False,
    )


def _recompute_total_progress(chapters: Dict[str, float]) -> float:
    if not chapters:
        return 0.0
    # Average chapter completion percentage 0..100
    values = list(chapters.values())
    return sum(values) / len(values)


@router.get("/{textbook_id}")
async def get_textbook_progress(textbook_id: str, current_user=Depends(validate_access_token)):
    """Return full progress payload for a textbook for this user.
    Shape: { total_progress, chapters: {"1": pct}, last_visit }
    """
    user_id = current_user
    doc = await _get_user_progress_doc(user_id)
    if not doc:
        return {"total_progress": 0, "chapters": {}, "last_visit": None}

    tb = (doc.get("textbook_progress", {}) or {}).get(textbook_id)
    if not tb:
        return {"total_progress": 0, "chapters": {}, "last_visit": None}
    return tb


class ChapterProgressUpdate(BaseModel):
    percent: float = Field(..., ge=0, le=100)
    page: Optional[int] = Field(None, ge=1)
    # optional: last visited chapter id if known on the client (numeric)
    chapter: Optional[int] = Field(None, ge=1)


@router.patch("/{textbook_id}/chapter/{chapter_id}")
async def update_chapter_progress(
    textbook_id: str,
    chapter_id: str,
    payload: ChapterProgressUpdate,
    current_user=Depends(validate_access_token),
):
    user_id = current_user
    await _ensure_user_progress_doc(user_id)
    collection = await get_collection("user_progress")

    chapter_key = str(chapter_id)

    # Ensure parent subdocument exists (separate write avoids path conflicts)
    await _ensure_textbook_progress_subdoc(user_id, textbook_id)

    update: Dict[str, Any] = {
        f"textbook_progress.{textbook_id}.chapters.{chapter_key}": payload.percent,
    }

    # Optionally update last_visit
    if payload.page is not None or payload.chapter is not None:
        last_visit_chapter = int(payload.chapter) if payload.chapter is not None else int(chapter_id)
        if payload.page is not None:
            update[f"textbook_progress.{textbook_id}.last_visit"] = {
                "chapter": last_visit_chapter,
                "page": int(payload.page),
            }

    # Write the chapter percentage (no upsert needed; parent ensured)
    await collection.update_one({"_id": user_id}, {"$set": update}, upsert=False)

    # Recompute total_progress server-side to keep consistent
    doc = await collection.find_one({"_id": user_id}, {"textbook_progress": 1})
    tb = (doc.get("textbook_progress", {}) or {}).get(textbook_id, {})
    chapters: Dict[str, float] = (tb.get("chapters") or {})
    total_progress = _recompute_total_progress(chapters)
    await collection.update_one(
        {"_id": user_id},
        {"$set": {f"textbook_progress.{textbook_id}.total_progress": total_progress}},
    )

    return {"ok": True, "total_progress": total_progress}


class LastVisitUpdate(BaseModel):
    chapter: int = Field(..., ge=1)
    page: int = Field(..., ge=1)


@router.patch("/{textbook_id}/last-visit")
async def update_last_visit(textbook_id: str, payload: LastVisitUpdate, current_user=Depends(validate_access_token)):
    user_id = current_user
    # Ensure parent subdocument exists to avoid update conflicts
    await _ensure_textbook_progress_subdoc(user_id, textbook_id)
    collection = await get_collection("user_progress")
    await collection.update_one({"_id": user_id}, {
        "$set": {f"textbook_progress.{textbook_id}.last_visit": {
            "chapter": int(payload.chapter),
            "page": int(payload.page),
        }}
    }, upsert=False)
    return {"ok": True}

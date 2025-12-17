from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from backend.db.database import get_collection
from backend.features.textbooks.models import Textbook


TEXTBOOKS_COLLECTION = "textbooks"


def _parse_textbook(doc: Dict[str, Any]) -> Textbook:
    """
    Validate/coerce a MongoDB textbook document into the canonical Pydantic model.
    """
    return Textbook.model_validate(doc)


async def find_textbook_by_id(textbook_id: str) -> Optional[Textbook]:
    collection = await get_collection(TEXTBOOKS_COLLECTION)
    doc = await collection.find_one({"_id": textbook_id})
    if not doc:
        return None
    return _parse_textbook(doc)


async def find_textbook_by_code(code: str) -> Optional[Textbook]:
    collection = await get_collection(TEXTBOOKS_COLLECTION)
    doc = await collection.find_one({"code": code})
    if not doc:
        return None
    return _parse_textbook(doc)


async def find_textbooks_by_ids(textbook_ids: Iterable[str]) -> List[Textbook]:
    """
    Fetch multiple textbooks by id (single DB roundtrip) and return them in the same
    order as `textbook_ids` (skipping missing ids).
    """
    ids = [tid for tid in textbook_ids if tid]
    if not ids:
        return []

    collection = await get_collection(TEXTBOOKS_COLLECTION)
    cursor = collection.find({"_id": {"$in": ids}})
    docs = await cursor.to_list(length=len(ids))

    by_id: Dict[str, Textbook] = {}
    for doc in docs:
        try:
            tb = _parse_textbook(doc)
            by_id[tb.id] = tb
        except Exception:
            # If a single document is malformed, skip it rather than failing the whole list.
            # Callers that need strict behavior should fetch by id with `find_textbook_by_id`.
            continue

    # Preserve input order
    return [by_id[tid] for tid in ids if tid in by_id]



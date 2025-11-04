"""Test preseed helpers.

Usage:
  - Import `seed_textbook`, `seed_user`, or `seed_all` from tests to programmatically seed test data.
  - Run directly to seed both textbook and user and print a JWT for the user:
      python backend/tests/preseed.py

This script uses the project's `mongo_service.init()` so it respects `USE_MOCK_DB` when set.
"""
from __future__ import annotations

import asyncio
from pathlib import Path
import sys
from datetime import datetime, timedelta
import os

# Ensure project root is importable when running as a script
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.db import mongo_service
from backend.db.models import Textbook, Chapter, Section, User
from backend.features.auth.service import hash_password, create_access_token


async def seed_textbook(code: str = "PHYSIC") -> Textbook:
    """Create a minimal textbook document if one doesn't already exist.

    Returns the existing or newly created Textbook document.
    """
    await mongo_service.init()

    existing = await Textbook.find_one({"code": code})
    if existing:
        print(f"Textbook with code={code} already exists: id={existing.id}")
        return existing

    sample = Textbook(
        author="Test Author",
        title="Seed Textbook",
        subject="Physics",
        code=code,
        chapters=[
            Chapter(id=1, title="Intro", file="ch1.pdf", start_page=1, sections=[Section(title="Sec 1", page_offset=1), Section(title="Sec 2", page_offset=6)]),
            Chapter(id=2, title="Advanced Topics", file="ch2.pdf", start_page=21, sections=[Section(title="Sec 2", page_offset=1)]),
        ],
        cover_url="/covers/seed.png",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    await sample.create()
    print(f"Inserted textbook {code} (id={sample.id})")
    return sample

async def seed_all():
    await seed_textbook()


if __name__ == "__main__":
    # Allow USE_MOCK_DB to control where this writes
    # Default behavior: will use mongomock when USE_MOCK_DB=1
    asyncio.run(seed_all())

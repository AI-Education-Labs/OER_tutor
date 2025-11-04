import os
import pytest
import pytest_asyncio
from pathlib import Path
import sys
# Configure tests to use mongomock for an in-memory MongoDB

# Use the mongomock path in mongo_service when running tests
os.environ.setdefault("USE_MOCK_DB", "1")

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from backend.db import mongo_service

# helper function for seting up Beanie (mongodb ORM) with mongomock
@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_beanie_mock_db():
    """Initialize the Beanie document models against an in-memory mongomock DB.

    This fixture runs once per test session before any tests. It sets
    `USE_MOCK_DB=1` (above) so `backend.db.mongo_service.init()` uses
    mongomock. On teardown it calls `mongo_service.close()` to cleanup.
    """
    await mongo_service.init()
    try:
        yield
    finally:
        try:
            await mongo_service.close()
        except Exception:
            # best-effort cleanup; don't mask test failures
            pass

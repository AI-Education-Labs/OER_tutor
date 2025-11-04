from pathlib import Path
from fastapi.testclient import TestClient
import sys
import pytest
from backend.tests.preseed import seed_all
import pytest_asyncio

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import os
os.environ.setdefault("USE_MOCK_DB", "1")

from backend.main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.mark.asyncio
async def test_add(client):
    await seed_all()
    # register user for test
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "testuser8", "email": "user18@gaml.com", "password": "testpassword"},
    )
    assert response.status_code == 201
    # login with said user (use the same username we registered)
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser8", "password": "testpassword"},
    )
    assert login_resp.status_code == 200

    # save http_only cookie(s) returned by login into the client's cookie jar
    # use update to merge cookies from the response into the TestClient session
    client.cookies.update(login_resp.cookies)
    # add textbook to user
    add_resp = client.post(
        "/api/v1/textbooks/add",
        json={"code": "PHYSIC"},
    )
    assert add_resp.status_code == 200



@pytest.mark.asyncio
async def test_list(client):
    await seed_all()
    # register user for test
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "testuser10", "email": "user10@example.com", "password": "testpassword"},
    )
    assert response.status_code == 201

    # login with said user (use the same username we registered)
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser10", "password": "testpassword"},
    )
    assert login_resp.status_code == 200

    # save http_only cookie(s) returned by login into the client's cookie jar
    # use update to merge cookies from the response into the TestClient session
    client.cookies.update(login_resp.cookies)

    # add textbook to user
    add_resp = client.post(
        "/api/v1/textbooks/add",
        json={"code": "PHYSIC"},
    )
    assert add_resp.status_code == 200

    # list textbooks for user
    # list textbooks for user
    list_resp = client.get("/api/v1/textbooks/list")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["textbookInfo"]["title"] == "Seed Textbook"


@pytest.mark.asyncio
async def test_get_book(client):
    await seed_all()
    # register user for test
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "testuser9", "email": "user9@example.com", "password": "testpassword"},
    )
    assert response.status_code == 201

    # login with said user (use the same username we registered)
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser9", "password": "testpassword"},
    )
    assert login_resp.status_code == 200

    # save http_only cookie(s) returned by login into the client's cookie jar
    # use update to merge cookies from the response into the TestClient session
    client.cookies.update(login_resp.cookies)

    # add textbook to user
    add_resp = client.post(
        "/api/v1/textbooks/add",
        json={"code": "PHYSIC"},
    )
    assert add_resp.status_code == 200

    # list textbooks for user
    list_resp = client.get("/api/v1/textbooks/list")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["textbookInfo"]["title"] == "Seed Textbook"

    # get textbook details
    textbook_id = list_resp.json()[0]["textbookInfo"]["_id"]
    details_resp = client.get(f"/api/v1/textbooks/{textbook_id}")
    # get textbook details
    textbook_id = list_resp.json()[0]["textbookInfo"]["_id"]
    details_resp = client.get(f"/api/v1/textbooks/{textbook_id}")
    assert details_resp.status_code == 200
    assert details_resp.json()["title"] == "Seed Textbook"

@pytest.mark.asyncio
async def test_get_chapter_pdf(client):
    await seed_all()
    # register user for test
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "testuser9", "email": "user9@example.com", "password": "testpassword"},
    )
    assert response.status_code == 201

    # login with said user (use the same username we registered)
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser9", "password": "testpassword"},
    )
    assert login_resp.status_code == 200

    # save http_only cookie(s) returned by login into the client's cookie jar
    # use update to merge cookies from the response into the TestClient session
    client.cookies.update(login_resp.cookies)

    # add textbook to user
    add_resp = client.post(
        "/api/v1/textbooks/add",
        json={"code": "PHYSIC"},
    )
    assert add_resp.status_code == 200

    # list textbooks for user
    list_resp = client.get("/api/v1/textbooks/list")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["textbookInfo"]["title"] == "Seed Textbook"

    textbook_id = list_resp.json()[0]["textbookInfo"]["_id"]

    # get chapter pdf
    chapter_pdf_resp = client.get(f"/api/v1/textbooks/{textbook_id}/chapters/1/pdf")
    assert chapter_pdf_resp.status_code == 200
    assert "pdf_url" in chapter_pdf_resp.json()
    assert "aws" in chapter_pdf_resp.json()["pdf_url"]
    # get chapter pdf
    chapter_pdf_resp = client.get(f"/api/v1/textbooks/{textbook_id}/chapters/1/pdf")
    assert chapter_pdf_resp.status_code == 200
    assert "pdf_url" in chapter_pdf_resp.json()
    assert "aws" in chapter_pdf_resp.json()["pdf_url"]

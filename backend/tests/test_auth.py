from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
import sys

# Ensure project root is on sys.path so `import backend` works when pytest runs from repo root
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


from backend.main import app

import os
print("Setting USE_MOCK_DB=1 for tests")
os.environ.setdefault("USE_MOCK_DB", "1")

client = TestClient(app)

def test_register():
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "testuser", "email": "user@example.com", "password": "testpassword"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "testuser"
    assert "id" in data

# TODO: parameterize this test to cover more cases (e.g., wrong password, non-existent user) later
def test_login():
    # First, register the user
    client.post(
        "/api/v1/auth/register",
        json={"username": "testuser2", "email": "user@example1.com", "password": "testpassword"},
    )

    # Now, attempt to log in
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser2", "password": "testpassword"},
    )
    assert response.status_code == 200
    assert (response.headers.get("set-cookie")) is not None

def test_auth_status():
    # Register and log in the user
    client.post(
        "/api/v1/auth/register",
        json={"username": "testuser3", "email": "test3@email.com", "password": "testpassword"},
    )

    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser3", "password": "testpassword"},
    )

    assert login_response.status_code == 200
    # TestClient stores cookies in its cookie jar automatically, so subsequent
    # requests using the same `client` will include the httpOnly cookie.
    assert client.cookies.get("access_token") is not None
    # Check auth status
    status_response = client.get("/api/v1/auth/status")
    assert status_response.status_code == 200
    status_data = status_response.json()
    assert status_data["is_authenticated"] is True
    assert status_data["user_uuid"] is not None

def test_logout():
    # Register and log in the user
    client.post(
        "/api/v1/auth/register",
        json={"username": "testuser4", "email": "user4@mail.com", "password": "testpassword"},
    )
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser4", "password": "testpassword"},
    )
    assert login_response.status_code == 200
    assert client.cookies.get("access_token") is not None

    # Now, log out. The TestClient will capture Set-Cookie headers and update its
    # cookie jar accordingly.
    logout_response = client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 200

    # The logout endpoint should return a Set-Cookie that clears the access_token
    set_cookie = logout_response.headers.get("set-cookie")
    assert set_cookie is not None
    # Ensure Set-Cookie attempts to clear the cookie (Max-Age=0 or access_token=;)
    assert "access_token=" in set_cookie
    assert ("Max-Age=0" in set_cookie) or ("expires=Thu, 01 Jan 1970" in set_cookie) or ("expires=0" in set_cookie)

    # Client cookie jar should no longer have the access_token
    assert client.cookies.get("access_token") is None

    # Check auth status after logout - should be unauthorized
    status_response = client.get("/api/v1/auth/status")
    assert status_response.status_code == 401



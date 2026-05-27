import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://card-rush-arena.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def guest_session(client):
    """Create a guest user, returns (token, user, auth_client)."""
    r = client.post(f"{API}/auth/guest", json={"username": "TEST_Guest"})
    assert r.status_code == 200, r.text
    data = r.json()
    token = data["session_token"]
    user = data["user"]
    auth_client = requests.Session()
    auth_client.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "X-Session-Token": token,
    })
    return token, user, auth_client

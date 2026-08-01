from fastapi.testclient import TestClient

from dockerts import __version__
from dockerts.app import create_app

client = TestClient(create_app())


def test_healthz():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__


def test_hello():
    resp = client.get("/hello/world")
    assert resp.status_code == 200
    assert resp.json() == {"message": "Hello, world!"}

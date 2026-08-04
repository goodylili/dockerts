from dockerts import __version__


def test_healthz(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__


def test_hello(client):
    resp = client.get("/hello/world")
    assert resp.status_code == 200
    assert resp.json() == {"message": "Hello, world!"}


def test_create_contact_persists(client):
    resp = client.post("/contacts", json={"name": "Ada", "phone": "+2348012345678"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Ada"
    assert body["phone"] == "+2348012345678"
    assert body["id"] > 0

    listed = client.get("/contacts")
    assert listed.status_code == 200
    assert [c["name"] for c in listed.json()] == ["Ada"]


def test_create_contact_is_idempotent(client):
    payload = {"name": "Ada", "phone": "+2348012345678"}
    first = client.post("/contacts", json=payload)
    second = client.post("/contacts", json=payload)

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json() == second.json()
    assert len(client.get("/contacts").json()) == 1


def test_create_contact_rejects_empty_name(client):
    resp = client.post("/contacts", json={"name": "", "phone": "+2348012345678"})
    assert resp.status_code == 422

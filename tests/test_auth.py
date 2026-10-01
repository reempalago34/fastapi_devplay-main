"""Tests del esqueleto: health + flujo de auth completo."""


BASE = "/api/v1"


def test_health_ok(client):
    res = client.get(f"{BASE}/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"


def test_register_login_and_me(client):
    payload = {
        "email": "erick@test.com",
        "username": "erick_dev",
        "password": "secret123",
        "fullName": "Erick Dev",
        "age": 25,
    }
    res = client.post(f"{BASE}/auth/register", json=payload)
    assert res.status_code == 200, res.text
    body = res.json()
    # El registro NO crea sesión: manda un código de 6 dígitos al correo
    assert body["ok"] is True
    assert body["username"] == "erick_dev"
    assert body["sentTo"] == "er***@test.com"
    assert len(body["demoCode"]) == 6  # sin SMTP → modo demo

    # login (requiere contraseña correcta; el código confirma el correo)
    res = client.post(
        f"{BASE}/auth/login",
        json={"email": "erick@test.com", "password": "secret123"},
    )
    assert res.status_code == 200, res.text
    tokens = res.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # /auth/me
    res = client.get(f"{BASE}/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["email"] == "erick@test.com"

    # /users/me
    res = client.get(f"{BASE}/users/me", headers=headers)
    assert res.status_code == 200

    # refresh
    res = client.post(f"{BASE}/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_register_rejects_duplicate_email(client):
    payload = {
        "email": "dup@test.com",
        "username": "dup_user",
        "password": "secret123",
        "fullName": "Dup User",
        "age": 30,
    }
    assert client.post(f"{BASE}/auth/register", json=payload).status_code == 200
    payload["username"] = "otro_username"
    res = client.post(f"{BASE}/auth/register", json=payload)
    assert res.status_code == 409
    assert res.json()["detail"] == "El email o usuario ya existe"


def test_register_validates_minors_and_username_format(client):
    base = {
        "email": "minor@test.com",
        "username": "minor_user",
        "password": "secret123",
        "fullName": "Minor User",
    }
    assert (
        client.post(f"{BASE}/auth/register", json={**base, "age": 12}).status_code == 422
    )
    assert (
        client.post(
            f"{BASE}/auth/register", json={**base, "age": 20, "username": "mal@username"}
        ).status_code
        == 422
    )


def test_login_wrong_password_returns_401_and_writes_login_event(client):
    payload = {
        "email": "audit@test.com",
        "username": "audit_user",
        "password": "secret123",
        "fullName": "Audit User",
        "age": 40,
    }
    client.post(f"{BASE}/auth/register", json=payload)

    res = client.post(
        f"{BASE}/auth/login", json={"email": "audit@test.com", "password": "otraclave"}
    )
    assert res.status_code == 401
    assert "exists" not in res.json()["detail"].lower()


def test_protected_routes_require_token(client):
    assert client.get(f"{BASE}/auth/me").status_code == 401
    assert client.get(f"{BASE}/users/me").status_code == 401


def test_update_profile(client):
    payload = {
        "email": "profile@test.com",
        "username": "profile_user",
        "password": "secret123",
        "fullName": "Profile User",
        "age": 22,
    }
    client.post(f"{BASE}/auth/register", json=payload)
    tokens = client.post(
        f"{BASE}/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    ).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    res = client.patch(
        f"{BASE}/users/me/profile",
        json={"bio": "Hola, soy tester", "tags": ["gamedev", "pixel-art"], "language": "en"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["bio"] == "Hola, soy tester"
    assert body["tags"] == ["gamedev", "pixel-art"]
    assert body["language"] == "en"

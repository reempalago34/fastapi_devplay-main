"""Tests de los flujos de auth: código de registro, recuperación de contraseña,
invitados y token realtime (M3 extra de Erick)."""

import pytest

from app.models.user import User
from app.services.login_code_service import mask_email
from app.utils.realtime import RealtimeTokenError, verify_realtime_token
from tests.factories import BASE, auth, make_user

GENERIC = "Código incorrecto o expirado. Revisa tu correo."


def register(client, email, username, **extra):
    payload = {
        "email": email,
        "username": username,
        "password": "secret123",
        "fullName": "Persona Demo",
        "age": 25,
        **extra,
    }
    return client.post(f"{BASE}/auth/register", json=payload)


# --------------------------- registro + código -----------------------------


def test_register_sends_code_and_verifies(client, db):
    res = register(client, "codigo@test.com", "codigo_user")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    assert body["id"] != "ignored"
    assert body["sentTo"] == mask_email("codigo@test.com")
    code = body["demoCode"]  # sin SMTP configurado → modo demo
    assert len(code) == 6 and code.isdigit()

    # código incorrecto → error genérico
    res = client.post(
        f"{BASE}/auth/verify-register",
        json={"email": "codigo@test.com", "code": "000000" if code != "000000" else "111111"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == GENERIC

    # código correcto → ok con el username
    res = client.post(
        f"{BASE}/auth/verify-register",
        json={"email": "codigo@test.com", "code": code},
    )
    assert res.status_code == 200, res.text
    assert res.json() == {"ok": True, "username": "codigo_user", "sentTo": None, "demoCode": None}

    # un solo uso: reutilizar el mismo código ya no vale
    res = client.post(
        f"{BASE}/auth/verify-register",
        json={"email": "codigo@test.com", "code": code},
    )
    assert res.status_code == 400

    # y con la cuenta confirmada se puede entrar
    res = client.post(
        f"{BASE}/auth/login", json={"email": "codigo@test.com", "password": "secret123"}
    )
    assert res.status_code == 200, res.text
    assert "access_token" in res.json()


def test_verify_register_unknown_email_is_generic(client, db):
    res = client.post(
        f"{BASE}/auth/verify-register",
        json={"email": "nadie@test.com", "code": "123456"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == GENERIC  # no revela si existe


def test_verify_register_resend(client, db):
    first_code = register(client, "reenvio@test.com", "reenvio_user").json()["demoCode"]

    res = client.post(
        f"{BASE}/auth/verify-register", json={"email": "reenvio@test.com", "resend": True}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    assert body["sentTo"] == mask_email("reenvio@test.com")
    assert len(body["demoCode"]) == 6

    # solo sirve el código más reciente: el anterior quedó reemplazado
    res = client.post(
        f"{BASE}/auth/verify-register",
        json={"email": "reenvio@test.com", "code": first_code},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == GENERIC

    # sin código ni resend → 400
    res = client.post(f"{BASE}/auth/verify-register", json={"email": "reenvio@test.com"})
    assert res.status_code == 400
    assert "6 dígitos" in res.json()["detail"]


def test_register_honeypot_ignores_bots(client, db):
    res = register(client, "bot@test.com", "bot_user", website="http://spam.com")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["id"] == "ignored"
    assert body["sentTo"] == "bo**@test.com"

    db.expire_all()
    assert db.query(User).filter(User.email == "bot@test.com").first() is None


def test_register_rate_limit(client, db):
    for i in range(5):
        assert register(client, f"rl{i}@test.com", f"rl_user_{i}").status_code == 200
    assert register(client, "rl6@test.com", "rl_user_6").status_code == 429


def test_code_antispam_five_codes_per_15_min(client, db):
    """Máx. 5 códigos por cuenta cada 15 minutos (no bombardear correos)."""
    user = make_user(db, "antispam@t.com", "antispam")
    for i in range(5):
        res = client.post(
            f"{BASE}/auth/verify-register",
            json={"email": user.email, "resend": True},
        )
        assert res.status_code == 200, f"resend {i}: {res.status_code}"

    res = client.post(f"{BASE}/auth/verify-register", json={"email": user.email, "resend": True})
    assert res.status_code == 429


# ------------------------- recuperar contraseña ----------------------------


def test_forgot_and_reset_password(client, db):
    alice = make_user(db, "recupera@t.com", "recupera", password="clave-vieja")

    # paso 1: siempre responde ok aunque el email no exista
    res = client.post(f"{BASE}/auth/forgot-password", json={"email": "nadie@t.com"})
    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert res.json()["sentTo"] is None

    res = client.post(f"{BASE}/auth/forgot-password", json={"email": alice.email})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["message"] == "Si el email existe, recibirás un código de recuperación"
    assert body["sentTo"] == mask_email(alice.email)
    code = body["demoCode"]
    assert len(code) == 6

    # paso 2: código incorrecto → 400 y la clave sigue igual
    res = client.post(
        f"{BASE}/auth/reset-password",
        json={
            "email": alice.email,
            "code": "999999" if code != "999999" else "888888",
            "password": "clave-nueva",
        },
    )
    assert res.status_code == 400
    assert client.post(
        f"{BASE}/auth/login", json={"email": alice.email, "password": "clave-vieja"}
    ).status_code == 200

    # código correcto → contraseña cambiada
    res = client.post(
        f"{BASE}/auth/reset-password",
        json={"email": alice.email, "code": code, "password": "clave-nueva"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["ok"] is True

    assert client.post(
        f"{BASE}/auth/login", json={"email": alice.email, "password": "clave-vieja"}
    ).status_code == 401
    assert client.post(
        f"{BASE}/auth/login", json={"email": alice.email, "password": "clave-nueva"}
    ).status_code == 200

    # el código ya no sirve para un segundo reset
    res = client.post(
        f"{BASE}/auth/reset-password",
        json={"email": alice.email, "code": code, "password": "otra-clave"},
    )
    assert res.status_code == 400


def test_reset_password_legacy_token(client, db):
    from datetime import UTC, datetime, timedelta

    alice = make_user(db, "legacy@t.com", "legacy_user", password="clave-vieja")
    alice.reset_token = "token-de-recuperacion-123"
    alice.reset_token_expiry = datetime.now(UTC) + timedelta(hours=1)
    db.commit()

    res = client.post(
        f"{BASE}/auth/reset-password",
        json={"token": "token-de-recuperacion-123", "password": "clave-nueva"},
    )
    assert res.status_code == 200, res.text
    assert client.post(
        f"{BASE}/auth/login", json={"email": alice.email, "password": "clave-nueva"}
    ).status_code == 200

    # token ya usado (se limpió) → 400
    res = client.post(
        f"{BASE}/auth/reset-password",
        json={"token": "token-de-recuperacion-123", "password": "otra-clave"},
    )
    assert res.status_code == 400
    assert "enlace" in res.json()["detail"]


def test_reset_password_validates_payload(client, db):
    res = client.post(f"{BASE}/auth/reset-password", json={"password": "corta"})
    assert res.status_code == 422

    res = client.post(f"{BASE}/auth/reset-password", json={"password": "correcta1"})
    assert res.status_code == 400
    assert "Datos inválidos" in res.json()["detail"]


# -------------------------------- invitados --------------------------------


def test_guest_creates_readonly_account(client, db):
    res = client.post(f"{BASE}/auth/guest", json={})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["isGuest"] is True
    assert body["username"].startswith("Invitado-")
    assert body["access_token"]
    headers = {"Authorization": f"Bearer {body['access_token']}"}

    me = client.get(f"{BASE}/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["is_guest"] is True

    # los invitados no entran con /auth/login (no tienen clave real)
    res = client.post(f"{BASE}/auth/login", json={"email": "x@y.com", "password": "cualquiera"})
    assert res.status_code == 401

    # ...ni compran en la tienda (aunque el artículo exista)
    from app.models.store import StoreItem

    item = StoreItem(name="Exclusivo", description="x", price=10, category="powerup", icon="Zap")
    db.add(item)
    db.commit()
    db.refresh(item)
    res = client.post(f"{BASE}/store/buy", json={"itemId": item.id}, headers=headers)
    assert res.status_code == 403


def test_guest_username_fallback_and_uniqueness(client, db):
    res = client.post(f"{BASE}/auth/guest", json={"username": "no valido!"})
    assert res.status_code == 200
    assert res.json()["username"].startswith("Invitado-")  # inválido → generado

    first = client.post(f"{BASE}/auth/guest", json={"username": "MismoNombre"}).json()
    second = client.post(f"{BASE}/auth/guest", json={"username": "MismoNombre"}).json()
    assert first["username"] == "MismoNombre"
    assert second["username"] == "MismoNombre1"  # sufijo de unicidad


def test_guest_rate_limit(client, db):
    for _ in range(3):
        assert client.post(f"{BASE}/auth/guest", json={}).status_code == 200
    assert client.post(f"{BASE}/auth/guest", json={}).status_code == 429


# ------------------------------ realtime -----------------------------------


def test_realtime_token_requires_auth(client, db):
    assert client.get(f"{BASE}/realtime-token").status_code == 401


def test_realtime_token_rejects_guests(client, db):
    guest = client.post(f"{BASE}/auth/guest", json={}).json()
    headers = {"Authorization": f"Bearer {guest['access_token']}"}
    res = client.get(f"{BASE}/realtime-token", headers=headers)
    assert res.status_code == 403
    assert "invitados" in res.json()["detail"].lower()


def test_realtime_token_signature_and_expiry(client, db):
    alice = make_user(db, "realtime@t.com", "realtime_user")
    res = client.get(f"{BASE}/realtime-token", headers=auth(alice))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["expiresIn"] == 30 * 60 * 1000

    exp, payload, sig = body["token"].split(".")
    assert len(sig) > 10 and exp.isdigit()

    claims = verify_realtime_token(body["token"])
    assert claims["uid"] == alice.id
    assert claims["un"] == "realtime_user"

    # firma manipulada → error
    tampered = f"{exp}.{payload}x.{sig}"
    with pytest.raises(RealtimeTokenError):
        verify_realtime_token(tampered)

    # expiración
    from app.utils import realtime as realtime_utils

    original = realtime_utils.TOKEN_TTL_MS
    realtime_utils.TOKEN_TTL_MS = -1
    try:
        expired, _ = realtime_utils.create_realtime_token(alice.id, alice.username)
        with pytest.raises(RealtimeTokenError):
            realtime_utils.verify_realtime_token(expired)
    finally:
        realtime_utils.TOKEN_TTL_MS = original

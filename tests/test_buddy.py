"""Tests de POST /buddy (M4): el asistente Pixel 🤖."""

import uuid

import pytest
from sqlalchemy import text

from app.core.database import engine
from app.services import buddy_service as svc
from tests.factories import auth, make_user

BASE = "/api/v1"


@pytest.fixture(autouse=True)
def _clean_state(database):
    from app.utils.rate_limit import _hits

    _hits.clear()
    with engine.begin() as conn:
        conn.execute(text('TRUNCATE TABLE "User", "Post" RESTART IDENTITY CASCADE'))
    yield
    _hits.clear()


def _user(db, prefix: str):
    name = f"{prefix}_{uuid.uuid4().hex[:8]}"
    return make_user(db, f"{name}@t.com", name)


def _ask(client, headers, text_msg: str = "hola Pixel"):
    return client.post(
        f"{BASE}/buddy", json={"messages": [{"role": "user", "content": text_msg}]},
        headers=headers,
    )


def test_buddy_requires_registered_user(client, db):
    # anónimo → 401
    assert _ask(client, None).status_code == 401

    # invitado → 401 (el frontend abre el panel de crear cuenta)
    guest = _user(db, "buddy_guest")
    guest.is_guest = True
    db.commit()
    res = _ask(client, auth(guest))
    assert res.status_code == 401
    assert "registrados" in res.json()["detail"]


def test_buddy_rejects_empty_conversation(client, db):
    headers = auth(_user(db, "buddy_empty"))
    res = client.post(f"{BASE}/buddy", json={"messages": []}, headers=headers)
    assert res.status_code == 400

    res = client.post(
        f"{BASE}/buddy",
        json={"messages": [{"role": "user", "content": "   "}]},
        headers=headers,
    )
    assert res.status_code == 400


def test_buddy_offline_mode_still_replies(client, db):
    """Sin ZAI_API_KEY la API responde 200 con el mensaje de modo demo."""
    headers = auth(_user(db, "buddy_offline"))
    res = _ask(client, headers, "¿qué hay de nuevo?")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["reply"]
    assert data["actions"] == []


def test_buddy_extracts_go_and_gesture_actions(client, db, monkeypatch):
    headers = auth(_user(db, "buddy_actions"))
    raw = "¡Vámonos a probar juegos! 🎮\n[[ir:betas]]\n[[gesto:saltar]]"

    def fake_chat_complete(_messages):
        return raw

    monkeypatch.setattr(svc, "chat_complete", fake_chat_complete)

    data = _ask(client, headers, "llévame a las betas y salta").json()
    assert "[[" not in data["reply"]
    assert data["reply"].startswith("¡Vámonos")
    assert {"type": "go", "value": "betas"} in [
        {"type": a["type"], "value": a["value"]} for a in data["actions"]
    ]
    assert {"type": "gesture", "value": "saltar"} in [
        {"type": a["type"], "value": a["value"]} for a in data["actions"]
    ]


def test_buddy_ignores_unknown_markers(client, db, monkeypatch):
    headers = auth(_user(db, "buddy_markers"))
    monkeypatch.setattr(
        svc, "chat_complete", lambda _m: "mira nada\n[[ir:centro]]\n[[gesto:volar]]"
    )

    data = _ask(client, headers).json()
    assert data["actions"] == []
    assert "[[" not in data["reply"]


def test_buddy_sends_system_prompt_and_history(client, db, monkeypatch):
    headers = auth(_user(db, "buddy_history"))
    seen: list[dict] = []

    def fake_chat_complete(messages):
        seen.extend(messages)
        return "¡hola!"

    monkeypatch.setattr(svc, "chat_complete", fake_chat_complete)

    client.post(
        f"{BASE}/buddy",
        json={
            "messages": [
                {"role": "user", "content": "primera pregunta"},
                {"role": "assistant", "content": "primera respuesta"},
                {"role": "user", "content": "segunda pregunta"},
            ]
        },
        headers=headers,
    )

    assert seen[0]["role"] == "system"
    assert seen[0]["content"] == svc.SYSTEM_PROMPT
    assert [m["role"] for m in seen[1:]] == ["user", "assistant", "user"]
    assert seen[-1]["content"] == "segunda pregunta"


def test_buddy_rate_limit(client, db, monkeypatch):
    headers = auth(_user(db, "buddy_rl"))
    monkeypatch.setattr(svc, "chat_complete", lambda _m: "ok")

    codes = [_ask(client, headers).status_code for _ in range(26)]
    assert codes[:25] == [200] * 25
    assert codes[25] == 429  # 25 mensajes cada 5 minutos

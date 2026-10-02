"""Tests de chat global, mensajes directos y notificaciones."""

import uuid

import pytest
from sqlalchemy import text

from app.core.database import engine
from tests.factories import auth, make_user

BASE = "/api/v1"


@pytest.fixture(autouse=True)
def _clean_state(database):
    """Aísla cada test: vacía las tablas de este dominio y el rate limit."""
    from app.utils.rate_limit import _hits

    _hits.clear()
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE "
                '"Notification", "DirectMessage", "ChatMessage", '
                '"PollVote", "PollOption", "Poll", "Comment", "Like", "Bookmark", '
                '"Stream", "Beta", "Post", "User" '
                "RESTART IDENTITY CASCADE"
            )
        )
    yield
    _hits.clear()


def register(db, username: str | None = None) -> dict:
    """Crea el usuario con la fábrica compartida del equipo."""
    name = username or f"user_{uuid.uuid4().hex[:8]}"
    user = make_user(db, email=f"{name}@test.com", username=name)
    return {
        "Authorization": auth(user)["Authorization"],
        "user_id": user.id,
        "username": user.username,
    }


@pytest.fixture()
def alice(db):
    return register(db, "alice_user")


@pytest.fixture()
def bob(db):
    return register(db, "bob_user")


def notify(db, recipient_id, sender_id, type_="LIKE", message="te gustó un post"):
    """Siembra una notificación directamente en BD."""
    from app.models.chat import Notification

    n = Notification(
        user_id=recipient_id,
        from_user_id=sender_id,
        type=type_,
        message=message,
        entity_id="post123",
        read=False,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


# ---------------------------------------------------------------- Chat global


def test_post_chat_message(client, alice):
    res = client.post(f"{BASE}/chat", json={"content": "hola gente"}, headers=alice)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["content"] == "hola gente"
    # el username va denormalizado en el mensaje
    assert body["username"] == "alice_user"


def test_post_chat_requires_auth(client):
    assert client.post(f"{BASE}/chat", json={"content": "hola"}).status_code == 401


def test_post_chat_rejects_empty(client, alice):
    assert client.post(f"{BASE}/chat", json={"content": "   "}, headers=alice).status_code == 422
    assert client.post(f"{BASE}/chat", json={}, headers=alice).status_code == 422


def test_list_chat_is_public_and_newest_first(client, alice):
    client.post(f"{BASE}/chat", json={"content": "primero"}, headers=alice)
    client.post(f"{BASE}/chat", json={"content": "segundo"}, headers=alice)

    # no hace falta token para leer
    res = client.get(f"{BASE}/chat")
    assert res.status_code == 200
    body = res.json()
    assert [m["content"] for m in body] == ["segundo", "primero"]


def test_list_chat_pagination(client, alice):
    for i in range(3):
        client.post(f"{BASE}/chat", json={"content": f"msg{i}"}, headers=alice)

    res = client.get(f"{BASE}/chat", params={"limit": 2})
    assert len(res.json()) == 2


# ---------------------------------------------------------------- Directos


def test_send_direct_message(client, alice, bob):
    res = client.post(f"{BASE}/dm/{bob['user_id']}", json={"content": "hola"}, headers=alice)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["senderId"] == alice["user_id"]
    assert body["recipientId"] == bob["user_id"]
    assert body["readAt"] is None


def test_send_dm_requires_auth(client, alice):
    assert client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "x"}).status_code == 401


def test_cannot_dm_yourself(client, alice):
    res = client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "x"}, headers=alice)
    assert res.status_code == 422


def test_dm_to_missing_user(client, alice):
    res = client.post(f"{BASE}/dm/noexiste", json={"content": "x"}, headers=alice)
    assert res.status_code == 404


def test_conversation_shows_both_directions(client, alice, bob):
    client.post(f"{BASE}/dm/{bob['user_id']}", json={"content": "hola"}, headers=alice)
    client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "qué tal"}, headers=bob)

    res = client.get(f"{BASE}/dm/{bob['user_id']}", headers=alice)
    assert res.status_code == 200
    body = res.json()
    # de más antiguo a más nuevo
    assert [m["content"] for m in body] == ["hola", "qué tal"]


def test_conversation_is_private(client, alice, bob, db):
    third = register(db, "third_user")
    client.post(f"{BASE}/dm/{bob['user_id']}", json={"content": "privado"}, headers=alice)

    # third no forma parte de la conversación: la ve vacía
    res = client.get(f"{BASE}/dm/{alice['user_id']}", headers=third)
    assert res.json() == []


def test_list_conversations(client, alice, bob):
    client.post(f"{BASE}/dm/{bob['user_id']}", json={"content": "primer mensaje"}, headers=alice)
    client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "respuesta"}, headers=bob)

    res = client.get(f"{BASE}/dm", headers=alice)
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    row = body[0]
    assert row["peerId"] == bob["user_id"]
    assert row["peerUsername"] == "bob_user"
    assert row["lastMessage"] == "respuesta"
    # alice no ha leído el mensaje de bob
    assert row["unreadCount"] == 1


def test_list_conversations_empty(client, alice):
    assert client.get(f"{BASE}/dm", headers=alice).json() == []


def test_mark_conversation_read(client, alice, bob):
    client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "1"}, headers=bob)
    client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "2"}, headers=bob)

    before = client.get(f"{BASE}/dm", headers=alice).json()[0]["unreadCount"]
    assert before == 2

    res = client.post(f"{BASE}/dm/{bob['user_id']}/read", headers=alice)
    assert res.status_code == 200
    assert res.json()["marked"] == 2

    after = client.get(f"{BASE}/dm", headers=alice).json()[0]["unreadCount"]
    assert after == 0


def test_mark_read_only_affects_that_conversation(client, alice, bob, db):
    carol = register(db, "carol_user")
    client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "de bob"}, headers=bob)
    client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "de carol"}, headers=carol)

    client.post(f"{BASE}/dm/{bob['user_id']}/read", headers=alice)

    rows = {r["peerId"]: r["unreadCount"] for r in client.get(f"{BASE}/dm", headers=alice).json()}
    assert rows[bob["user_id"]] == 0
    assert rows[carol["user_id"]] == 1


def test_mark_read_requires_auth(client, bob):
    assert client.post(f"{BASE}/dm/{bob['user_id']}/read").status_code == 401


# ---------------------------------------------------------------- Notificaciones


def test_list_notifications(client, alice, bob, db):
    notify(db, alice["user_id"], bob["user_id"], "LIKE", "le gustó tu post")
    notify(db, alice["user_id"], bob["user_id"], "FOLLOW", "te sigue")

    res = client.get(f"{BASE}/notifications", headers=alice)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert body["unreadCount"] == 2
    assert body["items"][0]["fromUsername"] == "bob_user"
    assert body["items"][0]["type"] in {"LIKE", "FOLLOW"}


def test_notifications_require_auth(client):
    assert client.get(f"{BASE}/notifications").status_code == 401


def test_notifications_are_per_user(client, alice, bob, db):
    notify(db, alice["user_id"], bob["user_id"])

    # bob no ve las notificaciones de alice
    assert client.get(f"{BASE}/notifications", headers=bob).json()["total"] == 0


def test_filter_unread_only(client, alice, bob, db):
    first = notify(db, alice["user_id"], bob["user_id"])
    notify(db, alice["user_id"], bob["user_id"])
    client.patch(f"{BASE}/notifications/{first.id}/read", headers=alice)

    res = client.get(f"{BASE}/notifications", params={"unread_only": True}, headers=alice)
    assert res.json()["total"] == 1


def test_mark_one_notification_read(client, alice, bob, db):
    n = notify(db, alice["user_id"], bob["user_id"])

    res = client.patch(f"{BASE}/notifications/{n.id}/read", headers=alice)
    assert res.status_code == 200
    assert res.json()["read"] is True
    assert client.get(f"{BASE}/notifications", headers=alice).json()["unreadCount"] == 0


def test_cannot_mark_someone_elses_notification(client, alice, bob, db):
    n = notify(db, alice["user_id"], bob["user_id"])
    # bob intenta marcar la notificación que es de alice
    assert client.patch(f"{BASE}/notifications/{n.id}/read", headers=bob).status_code == 404


def test_mark_all_read(client, alice, bob, db):
    for _ in range(3):
        notify(db, alice["user_id"], bob["user_id"])

    res = client.patch(f"{BASE}/notifications/read-all", headers=alice)
    assert res.status_code == 200
    assert res.json()["marked"] == 3
    assert client.get(f"{BASE}/notifications", headers=alice).json()["unreadCount"] == 0


def test_delete_notification(client, alice, bob, db):
    n = notify(db, alice["user_id"], bob["user_id"])

    assert client.delete(f"{BASE}/notifications/{n.id}", headers=alice).status_code == 204
    assert client.get(f"{BASE}/notifications", headers=alice).json()["total"] == 0


def test_cannot_delete_someone_elses_notification(client, alice, bob, db):
    n = notify(db, alice["user_id"], bob["user_id"])
    assert client.delete(f"{BASE}/notifications/{n.id}", headers=bob).status_code == 404


def test_delete_missing_notification(client, alice):
    assert client.delete(f"{BASE}/notifications/noexiste", headers=alice).status_code == 404


def test_unread_count_badge(client, alice, bob, db):
    client.post(f"{BASE}/dm/{alice['user_id']}", json={"content": "sin leer"}, headers=bob)
    notify(db, alice["user_id"], bob["user_id"])
    notify(db, alice["user_id"], bob["user_id"])

    res = client.get(f"{BASE}/notifications/unread-count", headers=alice)
    assert res.status_code == 200
    assert res.json() == {"notifications": 2, "direct_messages": 1}
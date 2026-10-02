"""Tests del feed de posts: CRUD, comentarios, likes, bookmarks y repost."""

import uuid

import pytest
from sqlalchemy import text

from app.core.database import engine
from tests.factories import auth, make_user

BASE = "/api/v1"


@pytest.fixture(autouse=True)
def _clean_state(database):
    """Aísla cada test: vacía las tablas y el rate limit global en memoria.

    La fixture `database` de conftest.py es de sesión (crea las tablas una vez),
    así que sin esto los usuarios de un test chocarían con los del siguiente.
    """
    from app.utils.rate_limit import _hits

    _hits.clear()
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE "
                '"Post", "Comment", "Like", "Bookmark", "User" '
                "RESTART IDENTITY CASCADE"
            )
        )
    yield
    _hits.clear()


def _unique(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def register(db, username: str | None = None) -> dict:
    """Crea un usuario en BD y devuelve sus headers.

    Usa la fábrica compartida del equipo en vez de POST /auth/register: el registro
    ahora exige un código de 6 dígitos y consumiría el rate limit (5/min por IP).
    """
    name = username or _unique("user")
    user = make_user(db, email=f"{name}@test.com", username=name)
    return {
        "Authorization": auth(user)["Authorization"],
        "user_id": user.id,
        "username": user.username,
    }


@pytest.fixture()
def author(db):
    return register(db, "author_user")


@pytest.fixture()
def reader(db):
    return register(db, "reader_user")


def make_post(client, headers, content="Hola mundo", media=None) -> dict:
    payload = {"content": content}
    if media is not None:
        payload["media"] = media
    res = client.post(f"{BASE}/posts", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


# --- Crear ---


def test_create_post(client, author):
    res = client.post(f"{BASE}/posts", json={"content": "Mi primer post"}, headers=author)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["content"] == "Mi primer post"
    assert body["type"] == "POST"
    assert body["author"]["username"] == "author_user"
    assert body["likes_count"] == 0
    assert body["comments_count"] == 0
    assert body["liked_by_me"] is False


def test_create_post_requires_auth(client):
    assert client.post(f"{BASE}/posts", json={"content": "x"}).status_code == 401


def test_create_post_needs_content_or_media(client, author):
    assert client.post(f"{BASE}/posts", json={}, headers=author).status_code == 422
    assert (
        client.post(f"{BASE}/posts", json={"content": "   "}, headers=author).status_code == 422
    )


def test_create_post_with_media(client, author):
    post = make_post(
        client,
        author,
        content="Mira esto",
        media=[{"url": "https://cdn.devplay.dev/a.png", "kind": "image"}],
    )
    assert len(post["media"]) == 1
    assert post["media"][0]["kind"] == "image"


# --- Leer ---


def test_get_feed_is_paginated_and_newest_first(client, author):
    make_post(client, author, "primero")
    make_post(client, author, "segundo")

    res = client.get(f"{BASE}/posts")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert body["items"][0]["content"] == "segundo"  # el más nuevo primero

    res = client.get(f"{BASE}/posts", params={"limit": 1})
    body = res.json()
    assert len(body["items"]) == 1
    assert body["total"] == 2


def test_get_feed_filter_by_author(client, author, reader):
    make_post(client, author, "de author")
    make_post(client, reader, "de reader")

    res = client.get(f"{BASE}/posts", params={"author_id": reader["user_id"]})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["content"] == "de reader"


def test_get_post_by_id(client, author):
    post = make_post(client, author)
    res = client.get(f"{BASE}/posts/{post['id']}")
    assert res.status_code == 200
    assert res.json()["id"] == post["id"]


def test_get_post_not_found(client):
    assert client.get(f"{BASE}/posts/noexiste").status_code == 404


# --- Editar / borrar ---


def test_update_post_only_author(client, author, reader):
    post = make_post(client, author)

    res = client.patch(
        f"{BASE}/posts/{post['id']}", json={"content": "editado"}, headers=author
    )
    assert res.status_code == 200
    assert res.json()["content"] == "editado"

    res = client.patch(
        f"{BASE}/posts/{post['id']}", json={"content": "hack"}, headers=reader
    )
    assert res.status_code == 403


def test_delete_post_only_author(client, author, reader):
    post = make_post(client, author)

    assert client.delete(f"{BASE}/posts/{post['id']}", headers=reader).status_code == 403
    assert client.delete(f"{BASE}/posts/{post['id']}", headers=author).status_code == 204
    assert client.get(f"{BASE}/posts/{post['id']}").status_code == 404


# --- Comentarios ---


def test_comment_flow(client, author, reader):
    post = make_post(client, author)

    res = client.post(
        f"{BASE}/posts/{post['id']}/comments",
        json={"content": "Buen post"},
        headers=reader,
    )
    assert res.status_code == 201, res.text
    assert res.json()["content"] == "Buen post"
    assert res.json()["author"]["username"] == "reader_user"

    res = client.get(f"{BASE}/posts/{post['id']}/comments")
    assert res.status_code == 200
    assert len(res.json()) == 1

    # el post ahora cuenta con 1 comentario
    assert client.get(f"{BASE}/posts/{post['id']}").json()["comments_count"] == 1


def test_comment_rejects_empty(client, author, reader):
    post = make_post(client, author)
    res = client.post(
        f"{BASE}/posts/{post['id']}/comments", json={"content": "   "}, headers=reader
    )
    assert res.status_code == 422


def test_comment_on_missing_post(client, reader):
    res = client.post(
        f"{BASE}/posts/noexiste/comments", json={"content": "x"}, headers=reader
    )
    assert res.status_code == 404


def test_delete_own_comment(client, author, reader):
    post = make_post(client, author)
    comment = client.post(
        f"{BASE}/posts/{post['id']}/comments", json={"content": "mi comentario"}, headers=reader
    ).json()

    res = client.delete(
        f"{BASE}/posts/{post['id']}/comments/{comment['id']}", headers=reader
    )
    assert res.status_code == 204
    assert client.get(f"{BASE}/posts/{post['id']}/comments").json() == []


# --- Likes ---


def test_toggle_like(client, author, reader):
    post = make_post(client, author)

    res = client.post(f"{BASE}/posts/{post['id']}/likes", headers=reader)
    assert res.status_code == 200
    assert res.json() == {"active": True, "count": 1}

    # la vista del que dio like lo marca como liked_by_me
    assert client.get(f"{BASE}/posts/{post['id']}", headers=reader).json()["liked_by_me"] is True
    # la vista de otro usuario no
    assert client.get(f"{BASE}/posts/{post['id']}", headers=author).json()["liked_by_me"] is False

    res = client.post(f"{BASE}/posts/{post['id']}/likes", headers=reader)
    assert res.json() == {"active": False, "count": 0}


def test_like_requires_auth(client, author):
    post = make_post(client, author)
    assert client.post(f"{BASE}/posts/{post['id']}/likes").status_code == 401


# --- Bookmarks ---


def test_toggle_bookmark(client, author, reader):
    post = make_post(client, author)

    res = client.post(f"{BASE}/posts/{post['id']}/bookmarks", headers=reader)
    assert res.json() == {"active": True, "count": 1}
    assert (
        client.get(f"{BASE}/posts/{post['id']}", headers=reader).json()["bookmarked_by_me"] is True
    )

    res = client.post(f"{BASE}/posts/{post['id']}/bookmarks", headers=reader)
    assert res.json() == {"active": False, "count": 0}


# --- Repost ---


def test_repost_once_per_user(client, db, author, reader):
    post = make_post(client, author, "contenido original")

    res = client.post(f"{BASE}/posts/{post['id']}/repost", headers=reader)
    assert res.status_code == 201, res.text
    # devuelve el post original para que el frontend pueda pintarlo
    assert res.json()["id"] == post["id"]
    assert res.json()["content"] == "contenido original"

    # segundo repost del mismo usuario → 409
    assert client.post(f"{BASE}/posts/{post['id']}/repost", headers=reader).status_code == 409

    # otro usuario sí puede repostear
    other = register(db, "third_user")
    assert client.post(f"{BASE}/posts/{post['id']}/repost", headers=other).status_code == 201

    # los reposts no aparecen en el feed general
    assert client.get(f"{BASE}/posts").json()["total"] == 1


def test_repost_appears_on_author_profile(client, author, reader):
    post = make_post(client, author)
    client.post(f"{BASE}/posts/{post['id']}/repost", headers=reader)

    # el feed del usuario que repostió sí incluye su repost
    feed = client.get(f"{BASE}/posts", params={"author_id": reader["user_id"]}).json()
    assert feed["total"] == 1
    assert feed["items"][0]["repost_of_id"] == post["id"]
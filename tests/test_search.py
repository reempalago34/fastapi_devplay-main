"""Tests de GET /search (M4): usuarios, posts y exclusiones."""

import uuid

import pytest
from sqlalchemy import text

from app.core.database import engine
from tests.factories import auth, make_user

BASE = "/api/v1"


@pytest.fixture(autouse=True)
def _clean_state(database):
    """Aísla cada test: vacía tablas y rate limit (mismo patrón que test_posts)."""
    from app.utils.rate_limit import _hits

    _hits.clear()
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE "
                '"User", "Post", "Beta", "Follow", "Block" '
                "RESTART IDENTITY CASCADE"
            )
        )
    yield
    _hits.clear()


def _unique(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def test_short_or_empty_query_returns_empty(client, db):
    make_user(db, "search_empty@t.com", _unique("carlos"))
    for q in ("", "a", "  "):
        res = client.get(f"{BASE}/search", params={"q": q})
        assert res.status_code == 200
        assert res.json()["users"] == []
        assert res.json()["posts"] == []


def test_finds_users_by_username_and_bio_case_insensitive(client, db):
    username = _unique("CarlosDev")
    dev = make_user(db, f"{username}@t.com", username)
    dev.bio = "Fan de los indies"
    db.commit()

    res = client.get(f"{BASE}/search", params={"q": username[:6].upper()})
    data = res.json()
    assert [u["username"] for u in data["users"]] == [username]
    assert data["users"][0]["followersCount"] == 0
    assert data["users"][0]["postsCount"] == 0

    res = client.get(f"{BASE}/search", params={"q": "INDIES"})
    assert [u["username"] for u in res.json()["users"]] == [username]


def test_guest_users_never_appear(client, db):
    guest = make_user(db, "search_guest@t.com", _unique("invitadito"))
    guest.is_guest = True
    db.commit()

    res = client.get(f"{BASE}/search", params={"q": "invitadito"})
    assert res.json()["users"] == []


def test_finds_posts_by_content_and_by_beta_title(client, db):
    username = _unique("author")
    author = make_user(db, f"{username}@t.com", username)
    headers = auth(author)

    res = client.post(
        f"{BASE}/posts", json={"content": "Charlando de Hollow Knight"}, headers=headers
    )
    assert res.status_code == 201

    res = client.post(
        f"{BASE}/betas",
        json={
            "title": "Celeste Retro",
            "description": "plataformas con alma",
            "download_type": "LINK",
            "external_url": "https://itch.io/celesteretro",
        },
        headers=headers,
    )
    assert res.status_code == 201

    found = client.get(f"{BASE}/search", params={"q": "hollow"}).json()["posts"]
    assert len(found) == 1
    assert "Hollow Knight" in found[0]["content"]

    # el texto de la ficha de la beta también cuenta
    found = client.get(f"{BASE}/search", params={"q": "CELESTE"}).json()["posts"]
    assert len(found) == 1

    # PostOut sale en snake_case (el frontend lo cameliza); los usuarios, en camelCase
    assert found[0]["likes_count"] == 0
    assert found[0]["author"]["username"] == username


def test_blocked_users_are_hidden_from_both_sides(client, db):
    alice_name = _unique("alice")
    bob_name = _unique("bob")
    alice = make_user(db, f"{alice_name}@t.com", alice_name)
    bob = make_user(db, f"{bob_name}@t.com", bob_name)
    client.post(
        f"{BASE}/posts", json={"content": "mensaje secreto de bob"}, headers=auth(bob)
    )

    # anónimo: todo visible
    anon = client.get(f"{BASE}/search", params={"q": "secreto"}).json()
    assert len(anon["posts"]) == 1
    anon_users = client.get(f"{BASE}/search", params={"q": bob_name}).json()["users"]
    assert len(anon_users) == 1

    # alice bloquea a bob → nada de bob para alice
    res = client.post(
        f"{BASE}/security/block", json={"blockedId": bob.id}, headers=auth(alice)
    )
    assert res.status_code == 200

    mine = client.get(
        f"{BASE}/search", params={"q": "secreto"}, headers=auth(alice)
    ).json()
    assert mine["posts"] == []
    mine_users = client.get(
        f"{BASE}/search", params={"q": bob_name}, headers=auth(alice)
    ).json()["users"]
    assert mine_users == []

    # y alice tampoco ve a bob desde el lado contrario del bloqueo
    bob_view = client.get(
        f"{BASE}/search", params={"q": alice_name}, headers=auth(bob)
    ).json()["users"]
    assert bob_view == []

"""Tests de encuestas: creación en un post, votación y conteos."""

import uuid
from datetime import UTC, datetime, timedelta

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
                '"PollVote", "PollOption", "Poll", "Comment", "Like", "Bookmark", "Post", "User" '
                "RESTART IDENTITY CASCADE"
            )
        )
    yield
    _hits.clear()


def register(db, username: str | None = None) -> dict:
    """Crea el usuario con la fábrica compartida (evita el código de verificación)."""
    name = username or f"user_{uuid.uuid4().hex[:8]}"
    user = make_user(db, email=f"{name}@test.com", username=name)
    return {"Authorization": auth(user)["Authorization"], "user_id": user.id}


@pytest.fixture()
def author(db):
    return register(db, "poll_author")


@pytest.fixture()
def voter(db):
    return register(db, "poll_voter")


def make_post(client, headers, content="post con encuesta") -> str:
    res = client.post(f"{BASE}/posts", json={"content": content}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def make_poll(client, post_id, headers, **overrides):
    payload = {
        "question": "¿Cuál es tu juego favorito?",
        "options": [{"text": "Zelda"}, {"text": "Mario"}],
        **overrides,
    }
    return client.post(f"{BASE}/posts/{post_id}/poll", json=payload, headers=headers)


# --- Crear ---


def test_create_poll(client, author):
    post_id = make_post(client, author)
    res = make_poll(client, post_id, author)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["question"] == "¿Cuál es tu juego favorito?"
    assert body["allow_multiple"] is False
    assert body["total_votes"] == 0
    assert body["is_closed"] is False
    assert [o["text"] for o in body["options"]] == ["Zelda", "Mario"]
    assert [o["position"] for o in body["options"]] == [0, 1]


def test_create_poll_requires_auth(client, author):
    post_id = make_post(client, author)
    res = client.post(
        f"{BASE}/posts/{post_id}/poll",
        json={"question": "q", "options": [{"text": "a"}, {"text": "b"}]},
    )
    assert res.status_code == 401


def test_create_poll_only_author(client, author, voter):
    post_id = make_post(client, author)
    res = make_poll(client, post_id, voter)
    assert res.status_code == 403


def test_create_poll_validates_options(client, author):
    post_id = make_post(client, author)

    # menos de 2 opciones
    assert (
        client.post(
            f"{BASE}/posts/{post_id}/poll",
            json={"question": "q", "options": [{"text": "solo una"}]},
            headers=author,
        ).status_code
        == 422
    )

    # opciones duplicadas
    assert make_poll(
        client, post_id, author, options=[{"text": "igual"}, {"text": "Igual"}]
    ).status_code == 422

    # pregunta vacía
    assert make_poll(client, post_id, author, question="   ").status_code == 422


def test_one_poll_per_post(client, author):
    post_id = make_post(client, author)
    assert make_poll(client, post_id, author).status_code == 201
    assert make_poll(client, post_id, author).status_code == 409


def test_create_poll_on_missing_post(client, author):
    assert make_poll(client, "noexiste", author).status_code == 404


# --- Leer ---


def test_get_poll_of_post(client, author):
    post_id = make_post(client, author)
    created = make_poll(client, post_id, author).json()

    res = client.get(f"{BASE}/posts/{post_id}/poll")
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]

    # post sin encuesta
    other = make_post(client, author, "sin encuesta")
    assert client.get(f"{BASE}/posts/{other}/poll").status_code == 404


def test_get_poll_by_id(client, author):
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()

    res = client.get(f"{BASE}/polls/{poll['id']}")
    assert res.status_code == 200
    assert res.json()["id"] == poll["id"]
    assert client.get(f"{BASE}/polls/noexiste").status_code == 404


def test_list_polls(client, author):
    for i in range(2):
        post_id = make_post(client, author, f"post {i}")
        make_poll(client, post_id, author, question=f"Pregunta {i}?")

    res = client.get(f"{BASE}/polls")
    assert res.status_code == 200
    assert len(res.json()) == 2
    # la más reciente primero
    assert res.json()[0]["question"] == "Pregunta 1?"


# --- Votar ---


def test_vote_single_option(client, author, voter):
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()
    zelda = next(o["id"] for o in poll["options"] if o["text"] == "Zelda")

    res = client.post(
        f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [zelda]}, headers=voter
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["created"] is True
    assert body["poll"]["total_votes"] == 1
    assert body["poll"]["voted_option_ids"] == [zelda]

    counted = next(o for o in body["poll"]["options"] if o["id"] == zelda)
    assert counted["vote_count"] == 1


def test_vote_requires_auth(client, author):
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()
    option_id = poll["options"][0]["id"]
    res = client.post(
        f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [option_id]}
    )
    assert res.status_code == 401


def test_single_choice_rejects_multiple_options(client, author, voter):
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()
    ids = [o["id"] for o in poll["options"]]

    res = client.post(f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": ids}, headers=voter)
    assert res.status_code == 422


def test_single_choice_vote_cannot_be_changed(client, author, voter):
    """En opción única el voto es definitivo: repetirlo con otra opción da 409."""
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()
    zelda, mario = (o["id"] for o in poll["options"])

    assert (
        client.post(
            f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [zelda]}, headers=voter
        ).status_code
        == 200
    )

    res = client.post(
        f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [mario]}, headers=voter
    )
    assert res.status_code == 409

    # el voto original sigue intacto
    final = client.get(f"{BASE}/polls/{poll['id']}").json()
    counts = {o["text"]: o["vote_count"] for o in final["options"]}
    assert counts == {"Zelda": 1, "Mario": 0}


def test_voting_same_option_twice_is_idempotent(client, author, voter):
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()
    zelda = poll["options"][0]["id"]

    first = client.post(
        f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [zelda]}, headers=voter
    )
    second = client.post(
        f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [zelda]}, headers=voter
    )
    assert first.status_code == 200
    assert first.json()["created"] is True
    assert second.status_code == 200
    assert second.json()["created"] is False
    # no se duplica el voto
    assert second.json()["poll"]["total_votes"] == 1


def test_multiple_choice_vote_can_be_replaced(client, author, voter):
    """Con allowMultiple el usuario puede cambiar su selección."""
    post_id = make_post(client, author)
    poll = make_poll(
        client, post_id, author, options=[{"text": "A"}, {"text": "B"}, {"text": "C"}],
        allow_multiple=True,
    ).json()
    a, b, c = (o["id"] for o in poll["options"])

    client.post(f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [a, b]}, headers=voter)
    res = client.post(f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [c]}, headers=voter)
    assert res.status_code == 200
    assert res.json()["created"] is False

    counts = {o["text"]: o["vote_count"] for o in res.json()["poll"]["options"]}
    assert counts == {"A": 0, "B": 0, "C": 1}
    assert res.json()["poll"]["total_votes"] == 1


def test_multiple_choice_allows_several(client, author, voter):
    post_id = make_post(client, author)
    poll = make_poll(
        client, post_id, author, options=[{"text": "A"}, {"text": "B"}, {"text": "C"}],
        allow_multiple=True,
    ).json()
    a, b = (o["id"] for o in poll["options"][:2])

    res = client.post(
        f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [a, b]}, headers=voter
    )
    assert res.status_code == 200
    counts = {o["text"]: o["vote_count"] for o in res.json()["poll"]["options"]}
    assert counts == {"A": 1, "B": 1, "C": 0}
    assert res.json()["poll"]["total_votes"] == 2


def test_vote_rejects_foreign_option(client, author, voter):
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()
    other_post = make_post(client, author, "otro")
    other_poll = make_poll(client, other_post, author).json()
    foreign = other_poll["options"][0]["id"]

    res = client.post(
        f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [foreign]}, headers=voter
    )
    assert res.status_code == 422


def test_vote_counts_accumulate(client, db, voter):
    users = [register(db) for _ in range(3)]
    post_id = make_post(client, users[0])
    poll = make_poll(client, post_id, users[0]).json()
    zelda = poll["options"][0]["id"]

    for user in users:
        assert (
            client.post(
                f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [zelda]}, headers=user
            ).status_code
            == 200
        )

    final = client.get(f"{BASE}/polls/{poll['id']}").json()
    assert final["total_votes"] == 3
    assert final["options"][0]["vote_count"] == 3


def test_voted_option_ids_are_per_user(client, author, voter):
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()
    zelda = poll["options"][0]["id"]

    client.post(f"{BASE}/polls/{poll['id']}/vote", json={"option_ids": [zelda]}, headers=voter)

    as_voter = client.get(f"{BASE}/polls/{poll['id']}", headers=voter).json()
    assert as_voter["voted_option_ids"] == [zelda]

    as_author = client.get(f"{BASE}/polls/{poll['id']}", headers=author).json()
    assert as_author["voted_option_ids"] == []

    anonymous = client.get(f"{BASE}/polls/{poll['id']}").json()
    assert anonymous["voted_option_ids"] == []


# --- Encuesta cerrada ---


def test_cannot_vote_on_closed_poll(client, author, voter):
    post_id = make_post(client, author)
    ya_cerrada = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    poll = make_poll(client, post_id, author, closes_at=ya_cerrada).json()

    assert poll["is_closed"] is True
    res = client.post(
        f"{BASE}/polls/{poll['id']}/vote",
        json={"option_ids": [poll["options"][0]["id"]]},
        headers=voter,
    )
    assert res.status_code == 409


def test_poll_open_in_the_future(client, author, voter):
    post_id = make_post(client, author)
    manana = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    poll = make_poll(client, post_id, author, closes_at=manana).json()

    assert poll["is_closed"] is False
    res = client.post(
        f"{BASE}/polls/{poll['id']}/vote",
        json={"option_ids": [poll["options"][0]["id"]]},
        headers=voter,
    )
    assert res.status_code == 200


# --- Integración con posts ---


def test_poll_is_deleted_with_its_post(client, author):
    post_id = make_post(client, author)
    poll = make_poll(client, post_id, author).json()

    assert client.delete(f"{BASE}/posts/{post_id}", headers=author).status_code == 204
    assert client.get(f"{BASE}/polls/{poll['id']}").status_code == 404
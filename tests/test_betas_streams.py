"""Tests de betas y directos: publicación, edición, descarga y emisión."""

import uuid

import pytest
from sqlalchemy import text

from app.core.database import engine
from app.utils.rate_limit import _hits

BASE = "/api/v1"


@pytest.fixture(autouse=True)
def _clean_state(database):
    """Aísla cada test: vacía tablas y rate limit (mismo patrón que los otros dominios)."""
    _hits.clear()
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE "
                '"PollVote", "PollOption", "Poll", "Comment", "Like", "Bookmark", '
                '"Stream", "Beta", "Post", "User" '
                "RESTART IDENTITY CASCADE"
            )
        )
    yield
    _hits.clear()


def register(client, username: str | None = None) -> dict:
    name = username or f"user_{uuid.uuid4().hex[:8]}"
    res = client.post(
        f"{BASE}/auth/register",
        json={
            "email": f"{name}@test.com",
            "username": name,
            "password": "secret123",
            "fullName": name.title()[:30],
            "age": 25,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    return {"Authorization": f"Bearer {body['access_token']}", "user_id": body["user"]["id"]}


@pytest.fixture()
def author(client):
    return register(client, "beta_author")


@pytest.fixture()
def other(client):
    return register(client, "beta_other")


def make_beta(client, headers, **overrides) -> dict:
    payload = {
        "title": "Pixel Dungeon",
        "description": "Un roguelike en pixel art",
        "download_type": "LINK",
        "external_url": "https://itch.io/pixeldungeon",
        "genre": "Roguelike",
        "version": "0.4.1",
        "platforms": ["Windows", "Linux"],
        "tags": ["pixel-art", "indie"],
        **overrides,
    }
    res = client.post(f"{BASE}/betas", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


# ---------------------------------------------------------------- Betas


def test_create_beta(client, author):
    beta = make_beta(client, author)
    assert beta["title"] == "Pixel Dungeon"
    assert beta["downloadType"] == "LINK"
    assert beta["betaStatus"] == "open_beta"
    assert beta["downloads"] == 0
    assert beta["platforms"] == ["Windows", "Linux"]
    assert beta["tags"] == ["pixel-art", "indie"]
    assert beta["postId"]


def test_create_beta_requires_auth(client):
    res = client.post(
        f"{BASE}/betas", json={"title": "Sin auth", "description": "x"}
    )
    assert res.status_code == 401


def test_create_beta_validates(client, author):
    # título muy corto
    assert (
        client.post(
            f"{BASE}/betas", json={"title": "ab", "description": "x"}, headers=author
        ).status_code
        == 422
    )
    # descripción vacía
    assert (
        client.post(
            f"{BASE}/betas", json={"title": "Titulo valido", "description": ""}, headers=author
        ).status_code
        == 422
    )
    # beta_status inválido
    assert (
        client.post(
            f"{BASE}/betas",
            json={
                "title": "Titulo valido",
                "description": "x",
                "betaStatus": "no_existe",
            },
            headers=author,
        ).status_code
        == 422
    )


def test_create_beta_makes_a_post(client, author):
    beta = make_beta(client, author)

    # el post asociado existe y es de tipo BETA
    post = client.get(f"{BASE}/posts/{beta['postId']}").json()
    assert post["type"] == "BETA"
    assert post["author"]["id"] == author["user_id"]


def test_list_betas(client, author):
    make_beta(client, author, title="Beta uno")
    make_beta(client, author, title="Beta dos", betaStatus="alpha")

    res = client.get(f"{BASE}/betas")
    assert res.status_code == 200
    assert len(res.json()) == 2
    # la más reciente primero
    assert res.json()[0]["title"] == "Beta dos"

    filtered = client.get(f"{BASE}/betas", params={"beta_status": "alpha"}).json()
    assert len(filtered) == 1
    assert filtered[0]["title"] == "Beta dos"


def test_list_betas_by_author(client, author, other):
    make_beta(client, author, title="De author")
    make_beta(client, other, title="De other")

    res = client.get(f"{BASE}/betas", params={"author_id": other["user_id"]})
    assert len(res.json()) == 1
    assert res.json()[0]["title"] == "De other"


def test_get_beta(client, author):
    beta = make_beta(client, author)
    assert client.get(f"{BASE}/betas/{beta['id']}").json()["id"] == beta["id"]
    assert client.get(f"{BASE}/betas/noexiste").status_code == 404


# ---------------------------------------------------------------- Editar


def test_update_beta_only_author(client, author, other):
    beta = make_beta(client, author)

    res = client.patch(
        f"{BASE}/betas/{beta['id']}",
        json={"title": "Pixel Dungeon 2", "betaStatus": "ended"},
        headers=author,
    )
    assert res.status_code == 200, res.text
    assert res.json()["title"] == "Pixel Dungeon 2"
    assert res.json()["betaStatus"] == "ended"

    res = client.patch(
        f"{BASE}/betas/{beta['id']}", json={"title": "Hackeado"}, headers=other
    )
    assert res.status_code == 403


def test_update_beta_syncs_post(client, author):
    beta = make_beta(client, author)
    client.patch(
        f"{BASE}/betas/{beta['id']}",
        json={"description": "Nueva descripcion"},
        headers=author,
    )
    post = client.get(f"{BASE}/posts/{beta['postId']}").json()
    assert post["content"] == "Nueva descripcion"


def test_update_beta_keeps_other_fields(client, author):
    beta = make_beta(client, author)
    res = client.patch(f"{BASE}/betas/{beta['id']}", json={"version": "0.5.0"}, headers=author)
    body = res.json()
    assert body["version"] == "0.5.0"
    assert body["title"] == "Pixel Dungeon"
    assert body["tags"] == ["pixel-art", "indie"]


# ---------------------------------------------------------------- Descargas


def test_download_link_beta(client, author):
    beta = make_beta(client, author)

    res = client.post(f"{BASE}/betas/{beta['id']}/download")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["url"] == "https://itch.io/pixeldungeon"
    assert body["downloads"] == 1

    # el contador de la ficha también sube
    assert client.get(f"{BASE}/betas/{beta['id']}").json()["downloads"] == 1


def test_download_direct_beta(client, author):
    beta = make_beta(
        client,
        author,
        download_type="DIRECT",
        external_url=None,
        file_url="https://cdn.devplay.dev/pixel.zip",
        file_name="pixel.zip",
        file_size=1048576,
    )

    res = client.post(f"{BASE}/betas/{beta['id']}/download")
    body = res.json()
    assert body["url"] == "https://cdn.devplay.dev/pixel.zip"
    assert body["fileName"] == "pixel.zip"
    assert body["fileSize"] == 1048576


def test_download_without_target(client, author):
    beta = make_beta(client, author, download_type="DIRECT", external_url=None)

    res = client.post(f"{BASE}/betas/{beta['id']}/download")
    assert res.status_code == 409


def test_download_counts_accumulate(client, author):
    beta = make_beta(client, author)
    for expected in range(1, 4):
        res = client.post(f"{BASE}/betas/{beta['id']}/download")
        assert res.json()["downloads"] == expected


def test_download_history(client, author):
    beta = make_beta(client, author)
    client.post(f"{BASE}/betas/{beta['id']}/download")

    res = client.get(f"{BASE}/betas/{beta['id']}/downloads")
    assert res.status_code == 200
    assert res.json()["total"] == 1
    assert res.json()["days"] == 7


# ---------------------------------------------------------------- Streams


def make_live(client, headers, **overrides) -> dict:
    payload = {
        "platform": "TWITCH",
        "title": "Jugando Pixel Dungeon",
        "stream_url": "https://twitch.tv/ejemplo",
        **overrides,
    }
    res = client.post(f"{BASE}/streams/go-live", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_go_live(client, author):
    stream = make_live(client, author)
    assert stream["isLive"] is True
    assert stream["platform"] == "TWITCH"
    assert stream["startedAt"] is not None
    assert stream["endedAt"] is None
    # sin embedUrl se deriva del streamUrl
    assert stream["embedUrl"] == "https://twitch.tv/ejemplo"


def test_go_live_requires_auth(client):
    res = client.post(
        f"{BASE}/streams/go-live",
        json={"platform": "TWITCH", "title": "x", "stream_url": "https://t.tv/e"},
    )
    assert res.status_code == 401


def test_only_one_live_stream_per_user(client, author):
    make_live(client, author)
    res = client.post(
        f"{BASE}/streams/go-live",
        json={"platform": "YOUTUBE", "title": "otro", "stream_url": "https://y.tv/e"},
        headers=author,
    )
    assert res.status_code == 409


def test_go_offline(client, author):
    make_live(client, author)
    res = client.post(f"{BASE}/streams/go-offline", headers=author)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["isLive"] is False
    assert body["endedAt"] is not None


def test_go_offline_when_not_live(client, author):
    assert client.post(f"{BASE}/streams/go-offline", headers=author).status_code == 409


def test_relive_after_offline(client, author):
    make_live(client, author)
    client.post(f"{BASE}/streams/go-offline", headers=author)
    assert make_live(client, author, title="Segunda emission")["title"] == "Segunda emission"


def test_list_streams(client, author):
    # Un usuario no puede tener dos directos vivos: se cierran entre emisiones.
    make_live(client, author, title="Emision uno")
    client.post(f"{BASE}/streams/go-offline", headers=author)
    make_live(client, author, title="Emision dos")

    res = client.get(f"{BASE}/streams")
    assert res.status_code == 200
    assert len(res.json()) == 2
    # la más reciente primero
    assert res.json()[0]["title"] == "Emision dos"

    live = client.get(f"{BASE}/streams/live").json()
    assert len(live) == 1
    assert live[0]["isLive"] is True
    assert live[0]["title"] == "Emision dos"


def test_filter_streams_by_platform(client, author, other):
    make_live(client, author, platform="TWITCH")
    make_live(client, other, platform="YOUTUBE")

    res = client.get(f"{BASE}/streams", params={"platform": "YOUTUBE"})
    assert len(res.json()) == 1
    assert res.json()[0]["platform"] == "YOUTUBE"


def test_get_stream(client, author):
    stream = make_live(client, author)
    assert client.get(f"{BASE}/streams/{stream['id']}").json()["id"] == stream["id"]
    assert client.get(f"{BASE}/streams/noexiste").status_code == 404


def test_stream_can_attach_to_post(client, author):
    post_id = client.post(
        f"{BASE}/posts", json={"content": "post del directo"}, headers=author
    ).json()["id"]

    stream = make_live(client, author, post_id=post_id)
    assert stream["postId"] == post_id


# ---------------------------------------------------------------- Integración


def test_beta_deleted_with_its_post(client, author):
    beta = make_beta(client, author)
    assert client.delete(f"{BASE}/posts/{beta['postId']}", headers=author).status_code == 204
    assert client.get(f"{BASE}/betas/{beta['id']}").status_code == 404


def test_stream_deleted_with_its_post(client, author):
    post_id = client.post(
        f"{BASE}/posts", json={"content": "post del directo"}, headers=author
    ).json()["id"]
    stream = make_live(client, author, post_id=post_id)

    assert client.delete(f"{BASE}/posts/{post_id}", headers=author).status_code == 204
    assert client.get(f"{BASE}/streams/{stream['id']}").status_code == 404
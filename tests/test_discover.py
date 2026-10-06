"""Tests de GET /discover (M4): las cinco secciones de la pantalla Descubrir."""

import json
import uuid

import pytest
from sqlalchemy import text

from app.core.database import engine
from app.models.beta import Beta
from tests.factories import auth, make_user

BASE = "/api/v1"


@pytest.fixture(autouse=True)
def _clean_state(database):
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


def _user(db, prefix: str):
    name = _unique(prefix)
    return make_user(db, f"{name}@t.com", name), name


def test_anonymous_gets_all_five_sections(client):
    data = client.get(f"{BASE}/discover").json()
    assert set(data) == {
        "trending",
        "recommendedUsers",
        "popularBetas",
        "popularTags",
        "recent",
    }
    assert all(isinstance(data[key], list) for key in data)


def test_trending_and_recent_exclude_blocked_and_own_posts(client, db):
    viewer, viewer_name = _user(db, "disc_viewer")
    other, other_name = _user(db, "disc_other")
    other_headers = auth(other)

    client.post(
        f"{BASE}/posts", json={"content": "post de otro usuario"}, headers=other_headers
    )
    client.post(f"{BASE}/posts", json={"content": "post propio"}, headers=auth(viewer))

    # sin sesión se ve todo (incluido el post del viewer)
    anon = client.get(f"{BASE}/discover").json()
    contents = [p["content"] for p in anon["trending"] if p["content"]]
    assert "post propio" in contents
    assert "post de otro usuario" in contents

    # con sesión, el viewer no ve sus propios posts ni los de quien bloqueó
    client.post(
        f"{BASE}/security/block", json={"blockedId": other.id}, headers=auth(viewer)
    )
    mine = client.get(f"{BASE}/discover", headers=auth(viewer)).json()
    mine_contents = [p["content"] for p in mine["trending"] if p["content"]]
    assert "post propio" not in mine_contents
    assert "post de otro usuario" not in mine_contents
    assert all(u["username"] != other_name for u in mine["recommendedUsers"])


def test_recommended_users_skip_guests_following_and_self(client, db):
    viewer, viewer_name = _user(db, "disc_rec")
    followed, followed_name = _user(db, "disc_followed")
    stranger, _ = _user(db, "disc_stranger")
    guest = make_user(db, "disc_guest@t.com", _unique("disc_guest"))
    guest.is_guest = True
    db.commit()

    client.post(f"{BASE}/follow", json={"followeeId": followed.id}, headers=auth(viewer))

    data = client.get(f"{BASE}/discover", headers=auth(viewer)).json()["recommendedUsers"]
    names = [u["username"] for u in data]
    assert stranger.username in names
    assert viewer_name not in names
    assert followed_name not in names
    assert guest.username not in names


def test_popular_betas_are_ordered_by_downloads(client, db):
    author, _ = _user(db, "disc_beta")
    headers = auth(author)
    for title in ("Poco Descargada", "Muy Descargada"):
        res = client.post(
            f"{BASE}/betas",
            json={
                "title": title,
                "description": "para el test",
                "download_type": "LINK",
                "external_url": "https://itch.io/x",
            },
            headers=headers,
        )
        assert res.status_code == 201, res.text

    for beta in db.query(Beta).all():
        beta.downloads = 5 if beta.title.startswith("Poco") else 50
    db.commit()

    data = client.get(f"{BASE}/discover").json()["popularBetas"]
    titles = [b["title"] for b in data]
    assert titles.index("Muy Descargada") < titles.index("Poco Descargada")
    assert data[0]["downloads"] == 50
    assert data[0]["author"]["username"] == author.username


def test_popular_tags_count_profiles_and_betas(client, db):
    tagged, tagged_name = _user(db, "disc_tagged")
    tagged.tags = json.dumps(["retro", "pixel"])
    db.commit()

    beta_author, _ = _user(db, "disc_tagauth")
    res = client.post(
        f"{BASE}/betas",
        json={
            "title": "Con Etiquetas",
            "description": "una beta",
            "download_type": "LINK",
            "external_url": "https://itch.io/y",
            "tags": ["retro", "coop"],
        },
        headers=auth(beta_author),
    )
    assert res.status_code == 201, res.text

    tags = client.get(f"{BASE}/discover").json()["popularTags"]
    counts = {t["tag"]: t["count"] for t in tags}
    assert counts["retro"] == 2  # perfil + beta
    assert counts["pixel"] == 1
    assert counts["coop"] == 1
    # ordenados de más a menos popular
    assert [t["count"] for t in tags] == sorted(
        (t["count"] for t in tags), reverse=True
    )


def test_trending_orders_by_engagement(client, db):
    author, _ = _user(db, "disc_trend")
    reader, _ = _user(db, "disc_reader")
    second, _ = _user(db, "disc_second")
    headers = auth(author)

    quiet = client.post(
        f"{BASE}/posts", json={"content": "sin interaccion"}, headers=headers
    ).json()
    loud = client.post(
        f"{BASE}/posts", json={"content": "post popular"}, headers=headers
    ).json()

    # "post popular" queda con 2 likes, "sin interaccion" con 1
    client.post(f"{BASE}/posts/{loud['id']}/likes", headers=auth(reader))
    client.post(f"{BASE}/posts/{loud['id']}/likes", headers=auth(second))
    client.post(f"{BASE}/posts/{quiet['id']}/likes", headers=auth(author))

    trending = client.get(f"{BASE}/discover").json()["trending"]
    contents = [p["content"] for p in trending if p["content"]]
    assert contents.index("post popular") < contents.index("sin interaccion")
    assert trending[0]["likes_count"] == 2

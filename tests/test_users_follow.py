"""Tests del M2: follow, perfiles públicos, stats, logros y bookmarks."""

from sqlalchemy import func, select

from app.models.chat import Notification
from app.models.content import Bookmark, Comment, Like, Post
from app.models.social import Follow
from tests.factories import BASE, auth, make_user

# ---------- follow ----------


def test_follow_requires_auth_but_status_allows_anonymous(client, db):
    alice = make_user(db, "u_follow_a@t.com", "u_follow_a")
    bob = make_user(db, "u_follow_b@t.com", "u_follow_b")

    assert client.post(f"{BASE}/follow", json={"followeeId": bob.id}).status_code == 401
    assert (
        client.delete(f"{BASE}/follow?followeeId={bob.id}").status_code == 401
    )

    res = client.get(f"{BASE}/follow?userId={bob.id}")
    assert res.status_code == 200
    assert res.json() == {"following": False, "followersCount": 0, "followingCount": 0}

    # también con identidad, pero sin seguir todavía
    res = client.get(f"{BASE}/follow?userId={alice.id}", headers=auth(alice))
    assert res.json() == {"following": False, "followersCount": 0, "followingCount": 0}


def test_follow_unfollow_flow_is_idempotent(client, db):
    alice = make_user(db, "u_flow_a@t.com", "u_flow_a")
    bob = make_user(db, "u_flow_b@t.com", "u_flow_b")
    headers = auth(alice)

    for _ in range(3):  # repetir no duplica ni notifica dos veces
        res = client.post(f"{BASE}/follow", json={"followeeId": bob.id}, headers=headers)
        assert res.status_code == 200, res.text
        assert res.json() == {"following": True}

    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Follow)) == 1
    notes = db.scalars(select(Notification).where(Notification.user_id == bob.id)).all()
    assert len(notes) == 1
    assert notes[0].type == "FOLLOW"

    res = client.get(f"{BASE}/follow?userId={bob.id}", headers=headers)
    assert res.json() == {"following": True, "followersCount": 1, "followingCount": 0}

    res = client.delete(f"{BASE}/follow?followeeId={bob.id}", headers=headers)
    assert res.status_code == 200
    assert res.json() == {"following": False}

    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Follow)) == 0
    assert db.scalar(
        select(func.count()).select_from(Notification).where(Notification.user_id == bob.id)
    ) == 1  # la notificación del follow previo no se borra


def test_follow_validation(client, db):
    alice = make_user(db, "u_val_a@t.com", "u_val_a")

    res = client.post(f"{BASE}/follow", json={"followeeId": alice.id}, headers=auth(alice))
    assert res.status_code == 400  # no seguirse a uno mismo

    res = client.post(f"{BASE}/follow", json={"followeeId": "no-existe"}, headers=auth(alice))
    assert res.status_code == 404

    res = client.post(f"{BASE}/follow", json={}, headers=auth(alice))
    assert res.status_code == 422


def test_follow_rate_limit(client, db):
    alice = make_user(db, "u_rl_a@t.com", "u_rl_a")
    bob = make_user(db, "u_rl_b@t.com", "u_rl_b")
    headers = auth(alice)

    for i in range(30):  # límite: 30 follow/min por usuario
        res = client.post(f"{BASE}/follow", json={"followeeId": bob.id}, headers=headers)
        assert res.status_code == 200, f"follow {i}: {res.status_code}"
    res = client.post(f"{BASE}/follow", json={"followeeId": bob.id}, headers=headers)
    assert res.status_code == 429


# ---------- perfil público ----------


def test_public_profile(client, db):
    alice = make_user(db, "u_prof_a@t.com", "u_prof_a")
    bob = make_user(db, "u_prof_b@t.com", "u_prof_b")

    res = client.get(f"{BASE}/users/{bob.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["username"] == "u_prof_b"
    assert body["user"]["postsCount"] == 0
    assert body["posts"] == []

    # Bob publica; Alice lo likea y lo sigue
    post = Post(author_id=bob.id, content="hola mundo")
    db.add(post)
    db.commit()
    db.refresh(post)
    db.add(Like(post_id=post.id, user_id=alice.id))
    db.commit()
    client.post(f"{BASE}/follow", json={"followeeId": bob.id}, headers=auth(alice))

    res = client.get(f"{BASE}/users/{bob.id}", headers=auth(alice))
    body = res.json()
    user = body["user"]
    assert user["postsCount"] == 1
    assert user["followersCount"] == 1
    assert user["isFollowing"] is True
    assert user["isBlocked"] is False and user["blockedMe"] is False

    assert len(body["posts"]) == 1
    post_out = body["posts"][0]
    assert post_out["content"] == "hola mundo"
    assert post_out["likesCount"] == 1
    assert post_out["liked"] is True
    assert post_out["author"]["username"] == "u_prof_b"

    # sin identidad: liked e isFollowing en false
    anon = client.get(f"{BASE}/users/{bob.id}").json()
    assert anon["posts"][0]["liked"] is False
    assert anon["user"]["isFollowing"] is False

    assert client.get(f"{BASE}/users/no-existe").status_code == 404


def test_followers_and_following_lists(client, db):
    alice = make_user(db, "u_lst_a@t.com", "u_lst_a")
    bob = make_user(db, "u_lst_b@t.com", "u_lst_b")
    carol = make_user(db, "u_lst_c@t.com", "u_lst_c")

    client.post(f"{BASE}/follow", json={"followeeId": bob.id}, headers=auth(alice))
    client.post(f"{BASE}/follow", json={"followeeId": bob.id}, headers=auth(carol))
    client.post(f"{BASE}/follow", json={"followeeId": carol.id}, headers=auth(alice))

    res = client.get(f"{BASE}/users/{bob.id}/followers")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    names = {f["username"] for f in body["followers"]}
    assert names == {"u_lst_a", "u_lst_c"}
    entry = next(f for f in body["followers"] if f["username"] == "u_lst_a")
    assert entry["followedAt"] and entry["postsCount"] == 0

    res = client.get(f"{BASE}/users/{alice.id}/following")
    body = res.json()
    assert body["total"] == 2
    assert {f["username"] for f in body["following"]} == {"u_lst_b", "u_lst_c"}

    # sin seguidores → lista vacía, total 0 (nadie sigue a alice)
    assert client.get(f"{BASE}/users/{alice.id}/followers").json() == {
        "followers": [],
        "total": 0,
    }


def test_by_username_lookup(client, db):
    bob = make_user(db, "u_name_b@t.com", "u_name_b")

    res = client.get(f"{BASE}/users/by-username/u_name_b")
    assert res.status_code == 200
    assert res.json()["user"] == {"id": bob.id, "username": "u_name_b"}

    res = client.get(f"{BASE}/users/by-username/nadie")
    assert res.status_code == 404
    assert res.json() == {"user": None}

    # no lo captura la ruta /users/{user_id}
    assert client.get(f"{BASE}/users/me").status_code == 401


# ---------- stats / logros / bookmarks ----------


def test_my_stats(client, db):
    alice = make_user(db, "u_stat_a@t.com", "u_stat_a")
    bob = make_user(db, "u_stat_b@t.com", "u_stat_b")

    assert client.get(f"{BASE}/users/me/stats").status_code == 401

    p1 = Post(author_id=alice.id, content="uno")
    p2 = Post(author_id=alice.id, content="dos")
    db.add_all([p1, p2])
    db.commit()
    db.refresh(p1)
    db.refresh(p2)
    db.add(Comment(post_id=p1.id, user_id=alice.id, content="comentario"))
    db.add(Like(post_id=p1.id, user_id=bob.id))
    db.add(Bookmark(post_id=p2.id, user_id=alice.id))
    db.commit()
    client.post(f"{BASE}/follow", json={"followeeId": alice.id}, headers=auth(bob))

    res = client.get(f"{BASE}/users/me/stats", headers=auth(alice))
    assert res.status_code == 200, res.text
    stats = res.json()["stats"]
    assert stats["posts"] == 2
    assert stats["comments"] == 1
    assert stats["likes"] == 0  # likes dados: 0 (el like es de bob)
    assert stats["followers"] == 1
    assert stats["bookmarks"] == 1
    assert stats["totalLikesReceived"] == 1
    # puntos = 2 posts + 1 like recibido + 3 por seguidor = 6
    assert stats["points"] == 6
    assert stats["level"] == 1
    assert stats["pointsForNextLevel"] == 10
    assert stats["progressToNext"] == 60.0

    assert len(stats["activityByDay"]) == 7
    assert stats["activityByDay"][-1]["count"] == 2  # los 2 posts son de hoy


def test_my_achievements(client, db):
    alice = make_user(db, "u_ach_a@t.com", "u_ach_a")

    assert client.get(f"{BASE}/users/me/achievements").status_code == 401

    db.add(Post(author_id=alice.id, content="primer post"))
    db.commit()

    res = client.get(f"{BASE}/users/me/achievements", headers=auth(alice))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 21
    assert body["totalUnlocked"] >= 1
    assert all(a["tier"] in {"bronze", "silver", "gold", "platinum"} for a in body["achievements"])

    first = next(a for a in body["achievements"] if a["id"] == "first-post")
    assert first["unlocked"] is True
    assert first["progress"] == first["target"] == 1

    locked = next(a for a in body["achievements"] if a["id"] == "followers-100")
    assert locked["unlocked"] is False
    assert locked["progress"] == 0 and locked["target"] == 100


def test_my_bookmarks(client, db):
    alice = make_user(db, "u_bm_a@t.com", "u_bm_a")
    bob = make_user(db, "u_bm_b@t.com", "u_bm_b")

    assert client.get(f"{BASE}/users/me/bookmarks").status_code == 401

    post = Post(author_id=bob.id, content="guardado")
    db.add(post)
    db.commit()
    db.refresh(post)
    db.add(Bookmark(post_id=post.id, user_id=alice.id))
    db.commit()

    res = client.get(f"{BASE}/users/me/bookmarks", headers=auth(alice))
    assert res.status_code == 200, res.text
    posts = res.json()["posts"]
    assert len(posts) == 1
    assert posts[0]["id"] == post.id
    assert posts[0]["content"] == "guardado"
    assert posts[0]["author"]["username"] == "u_bm_b"
    assert posts[0]["savedAt"] is not None

    # Bob no ve el bookmark de Alice
    assert client.get(f"{BASE}/users/me/bookmarks", headers=auth(bob)).json()["posts"] == []

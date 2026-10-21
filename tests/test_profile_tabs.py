"""Tests del perfil de usuario: pestañas de "Me gusta" y "Multimedia".

Verifican que los endpoints devuelven datos reales de la BD, que la
privacidad se aplica en el servidor (no solo ocultando botones) y que la
pestaña de multimedia recoge imágenes y videos de las publicaciones.
"""

import pytest
from sqlalchemy import select

from app.models.content import Like, Post
from app.models.social import Follow
from app.models.user import User
from tests.factories import BASE, auth, make_user


@pytest.fixture(autouse=True)
def _clean_follows(db):
    """Este archivo crea Follows; se limpian para no contaminar otros tests
    que cuentan la tabla de forma global."""
    db.query(Follow).delete()
    db.commit()
    yield
    db.query(Follow).delete()
    db.commit()


def _post_with_media(db, author: User, content: str, media=None) -> Post:
    post = Post(
        author_id=author.id,
        type="POST",
        content=content,
        media_urls=(
            '[{"url":"https://example.com/a.png","kind":"image"},'
            '{"url":"https://example.com/b.mp4","kind":"video"}]'
            if media
            else None
        ),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


# ---------- Me gusta ----------


def test_liked_posts_endpoint_lists_real_likes(client, db):
    alice = make_user(db, "u_likes_a@t.com", "u_likes_a")
    bob = make_user(db, "u_likes_b@t.com", "u_likes_b")
    post = _post_with_media(db, bob, "publicacion de bob")

    # Bob marca su propia publicación con like.
    db.add(Like(post_id=post.id, user_id=bob.id))
    db.commit()

    res = client.get(f"{BASE}/users/{bob.id}/likes")
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == post.id
    assert body["items"][0]["content"] == "publicacion de bob"


def test_liked_posts_are_empty_when_user_has_no_likes(client, db):
    alice = make_user(db, "u_likes_c@t.com", "u_likes_c")
    res = client.get(f"{BASE}/users/{alice.id}/likes")
    assert res.status_code == 200
    assert res.json()["items"] == []


def test_liked_posts_mark_as_liked_for_the_viewer(client, db):
    alice = make_user(db, "u_likes_d@t.com", "u_likes_d")
    bob = make_user(db, "u_likes_e@t.com", "u_likes_e")
    post = _post_with_media(db, bob, "post con like de alice")
    db.add(Like(post_id=post.id, user_id=alice.id))
    db.commit()

    # Alice ve su propia lista con liked=true.
    res = client.get(f"{BASE}/users/{alice.id}/likes", headers=auth(alice))
    assert res.status_code == 200
    assert res.json()["items"][0]["liked"] is True

    # Un tercero ve la misma publicación sin liked.
    res = client.get(f"{BASE}/users/{alice.id}/likes", headers=auth(bob))
    assert res.json()["items"][0]["liked"] is False


def test_liked_posts_respects_private_profile(client, db):
    alice = make_user(db, "u_likes_priv@t.com", "u_likes_priv")
    bob = make_user(db, "u_likes_other@t.com", "u_likes_other")
    alice.is_private = True
    db.commit()

    # Otro usuario no puede ver los "me gusta" de un perfil privado.
    res = client.get(f"{BASE}/users/{alice.id}/likes", headers=auth(bob))
    assert res.status_code == 403

    # El propio usuario sí.
    res = client.get(f"{BASE}/users/{alice.id}/likes", headers=auth(alice))
    assert res.status_code == 200


def test_liked_posts_404_for_unknown_user(client):
    res = client.get(f"{BASE}/users/no_existe_1234/likes")
    assert res.status_code == 404


# ---------- Multimedia ----------


def test_user_media_endpoint_lists_post_media(client, db):
    alice = make_user(db, "u_media_a@t.com", "u_media_a")
    _post_with_media(db, alice, "con multimedia", media=True)

    res = client.get(f"{BASE}/users/{alice.id}/media")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 2
    kinds = sorted(i["kind"] for i in items)
    assert kinds == ["image", "video"]
    assert all(i["postId"] for i in items)


def test_user_media_is_empty_without_media(client, db):
    alice = make_user(db, "u_media_b@t.com", "u_media_b")
    _post_with_media(db, alice, "sin multimedia")

    res = client.get(f"{BASE}/users/{alice.id}/media")
    assert res.status_code == 200
    assert res.json()["items"] == []


def test_user_media_respects_private_profile(client, db):
    alice = make_user(db, "u_media_priv@t.com", "u_media_priv")
    bob = make_user(db, "u_media_other@t.com", "u_media_other")
    alice.is_private = True
    db.commit()

    res = client.get(f"{BASE}/users/{alice.id}/media", headers=auth(bob))
    assert res.status_code == 403

    res = client.get(f"{BASE}/users/{alice.id}/media", headers=auth(alice))
    assert res.status_code == 200


def test_user_media_404_for_unknown_user(client):
    res = client.get(f"{BASE}/users/no_existe_5678/media")
    assert res.status_code == 404


# ---------- Integración con el perfil ----------


def test_profile_still_lists_posts_after_new_endpoints(client, db):
    alice = make_user(db, "u_profile_ok@t.com", "u_profile_ok")
    _post_with_media(db, alice, "hola mundo")

    res = client.get(f"{BASE}/users/{alice.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["username"] == "u_profile_ok"
    assert body["user"]["postsCount"] == 1
    assert len(body["posts"]) == 1


# ---------- Privacidad del perfil (aplicada en el servidor) ----------


def test_private_profile_is_hidden_from_non_followers(client, db):
    alice = make_user(db, "u_priv_a@t.com", "u_priv_a")
    bob = make_user(db, "u_priv_b@t.com", "u_priv_b")
    alice.is_private = True
    db.commit()
    _post_with_media(db, alice, "contenido privado")

    # Un usuario que no sigue a Alice no puede ver su perfil.
    res = client.get(f"{BASE}/users/{alice.id}", headers=auth(bob))
    assert res.status_code == 403

    # Tampoco de forma anónima.
    res = client.get(f"{BASE}/users/{alice.id}")
    assert res.status_code == 403

    # Alice sí puede verse a sí misma.
    res = client.get(f"{BASE}/users/{alice.id}", headers=auth(alice))
    assert res.status_code == 200


def test_private_profile_is_visible_to_followers(client, db):
    alice = make_user(db, "u_priv_c@t.com", "u_priv_c")
    bob = make_user(db, "u_priv_d@t.com", "u_priv_d")
    alice.is_private = True
    db.add(Follow(follower_id=bob.id, followee_id=alice.id))
    db.commit()

    res = client.get(f"{BASE}/users/{alice.id}", headers=auth(bob))
    assert res.status_code == 200
    assert res.json()["user"]["username"] == "u_priv_c"


def test_public_profile_stays_visible(client, db):
    alice = make_user(db, "u_pub_a@t.com", "u_pub_a")
    bob = make_user(db, "u_pub_b@t.com", "u_pub_b")

    res = client.get(f"{BASE}/users/{alice.id}", headers=auth(bob))
    assert res.status_code == 200
    assert res.json()["user"]["postsCount"] == 0

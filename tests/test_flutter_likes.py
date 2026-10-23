"""Contrato con el cliente Flutter (repo frankalexander-GM/flutter-dev).

La pestaña "me gusta" del perfil (`GET /users/{id}/likes`).
"""

from tests.factories import BASE, auth, make_user


def test_user_likes_lists_liked_posts(client, db):
    """La pestaña "me gusta" del perfil."""
    alice = make_user(db, "flutter_likes@t.com", "flutter_likes")
    headers = auth(alice)
    post = client.post(
        f"{BASE}/posts", json={"type": "POST", "content": "me gusta"}, headers=headers
    )
    post_id = post.json()["id"]
    client.post(f"{BASE}/posts/{post_id}/likes", headers=headers)

    body = client.get(f"{BASE}/users/{alice.id}/likes").json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == post_id
    assert body["items"][0]["content"] == "me gusta"

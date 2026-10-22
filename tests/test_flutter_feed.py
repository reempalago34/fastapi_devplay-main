"""Contrato con el cliente Flutter (repo frankalexander-GM/flutter-dev).

El feed: `GET /posts` acepta `type` (filtro por tipo) y `sort` (latest/trending).
"""

from tests.factories import BASE, auth, make_user

# ---------- feed: type y sort ----------


def test_posts_accepts_type_filter(client, db):
    """Flutter filtra el feed con `type`."""
    alice = make_user(db, "flutter_type@t.com", "flutter_type")
    headers = auth(alice)
    client.post(f"{BASE}/posts", json={"type": "POST", "content": "normal"}, headers=headers)
    client.post(f"{BASE}/posts", json={"type": "BETA", "content": "una beta"}, headers=headers)

    body = client.get(f"{BASE}/posts?type=BETA").json()
    assert body["total"] >= 1
    assert all(p["type"] == "BETA" for p in body["items"])

    # sin filtro vienen ambos
    sin_filtro = client.get(f"{BASE}/posts").json()
    tipos = {p["type"] for p in sin_filtro["items"]}
    assert {"POST", "BETA"} <= tipos


def test_posts_accepts_trending_sort(client, db):
    """Flutter pide `sort=trending` para la sección de tendencia."""
    alice = make_user(db, "flutter_sort@t.com", "flutter_sort")
    headers = auth(alice)
    post = client.post(f"{BASE}/posts", json={"type": "POST", "content": "hot"}, headers=headers)
    post_id = post.json()["id"]
    otro = client.post(f"{BASE}/posts", json={"type": "POST", "content": "cold"}, headers=headers)
    otro_id = otro.json()["id"]
    client.post(f"{BASE}/posts/{post_id}/likes", headers=headers)

    body = client.get(f"{BASE}/posts?sort=trending").json()
    assert body["items"], "el feed trending no puede venir vacío"
    # el post con like va antes que el que no tiene (orden relativo)
    ids = [p["id"] for p in body["items"]]
    assert ids.index(post_id) < ids.index(otro_id)

    # y `latest` sigue siendo por fecha: el más reciente primero
    latest = client.get(f"{BASE}/posts?sort=latest").json()
    ids_latest = [p["id"] for p in latest["items"]]
    assert ids_latest.index(otro_id) < ids_latest.index(post_id)


def test_posts_rejects_unknown_sort(client):
    assert client.get(f"{BASE}/posts?sort=inventado").status_code == 422

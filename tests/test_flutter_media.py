"""Contrato con el cliente Flutter (repo frankalexander-GM/flutter-dev).

Medios del usuario: subida de archivos (avatar, portada, galería).
"""

import io

from tests.factories import BASE, auth, make_user


def png_bytes() -> bytes:
    """Un PNG mínimo válido (cabecera + 1x1)."""
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


# ---------- medios del usuario ----------


def test_upload_media_and_list_it(client, db, tmp_path, monkeypatch):
    """El flujo completo: subir avatar, listar la galería y borrarlo."""
    monkeypatch.setenv("MEDIA_DIR", str(tmp_path / "media"))
    from app.core.config import get_settings

    get_settings.cache_clear()

    alice = make_user(db, "flutter_media@t.com", "flutter_media")
    headers = auth(alice)

    res = client.post(
        f"{BASE}/users/me/media",
        files={"file": ("avatar.png", io.BytesIO(png_bytes()), "image/png")},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["url"].endswith(".png")
    assert body["kind"] == "image"
    assert body["filename"] == "avatar.png"
    assert body["size"] > 0

    # la galería del usuario
    galeria = client.get(f"{BASE}/users/{alice.id}/media").json()
    assert galeria["total"] == 1
    assert galeria["items"][0]["url"] == body["url"]
    assert galeria["items"][0]["kind"] == "image"
    assert galeria["items"][0]["createdAt"]

    # se puede usar como avatar
    perfil = client.patch(
        f"{BASE}/users/me/profile", json={"avatar": body["url"]}, headers=headers
    ).json()
    assert perfil["avatar"] == body["url"]

    # y se borra
    res = client.delete(f"{BASE}/users/me/media", params={"url": body["url"]}, headers=headers)
    assert res.status_code == 200
    assert client.get(f"{BASE}/users/{alice.id}/media").json()["total"] == 0

    get_settings.cache_clear()


def test_upload_media_rejects_bad_extension(client, db, monkeypatch, tmp_path):
    monkeypatch.setenv("MEDIA_DIR", str(tmp_path / "media"))
    from app.core.config import get_settings

    get_settings.cache_clear()

    alice = make_user(db, "flutter_bad@t.com", "flutter_bad")
    res = client.post(
        f"{BASE}/users/me/media",
        files={"file": ("malware.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        headers=auth(alice),
    )
    assert res.status_code == 400
    assert "Formato no permitido" in res.json()["detail"]

    get_settings.cache_clear()


def test_upload_media_requires_auth(client, db, monkeypatch, tmp_path):
    monkeypatch.setenv("MEDIA_DIR", str(tmp_path / "media"))
    res = client.post(
        f"{BASE}/users/me/media",
        files={"file": ("avatar.png", io.BytesIO(png_bytes()), "image/png")},
    )
    assert res.status_code == 401

    from app.core.config import get_settings

    get_settings.cache_clear()

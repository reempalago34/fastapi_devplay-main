"""Tests de la subida de archivos (avatar, portada y galería).

Verifican que se aceptan las imágenes y videos permitidos, que se rechazan
los formatos no permitidos y que el tamaño máximo se aplica.
"""

import io

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.services import media_service as media_svc
from tests.factories import BASE, auth, make_user

PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000a49444154789c6360000002000100055c0d0a2db400"
    "00000049454e44ae426082"
)
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 64


@pytest.fixture()
def uploads_dir(tmp_path, monkeypatch):
    """Redirige la carpeta de subidas a un temporal."""
    monkeypatch.setattr(media_svc, "uploads_root", lambda settings=None: tmp_path)
    return tmp_path


def _upload(client, user, filename, content_type, data):
    return client.post(
        f"{BASE}/users/me/media",
        files={"file": (filename, data, content_type)},
        headers=auth(user),
    )


def test_upload_image_returns_public_url(client, db, uploads_dir):
    user = make_user(db, "u_up_a@t.com", "u_up_a")
    res = _upload(client, user, "avatar.png", "image/png", PNG_BYTES)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["kind"] == "image"
    assert body["size"] == len(PNG_BYTES)
    assert body["url"].endswith(".png")
    assert "/uploads/" in body["url"]
    # El archivo existe realmente en disco.
    assert list(uploads_dir.glob("*.png"))


def test_upload_accepts_jpeg_and_webp(client, db, uploads_dir):
    user = make_user(db, "u_up_b@t.com", "u_up_b")
    for name, ctype, data in [
        ("foto.jpg", "image/jpeg", JPEG_BYTES),
        ("foto.webp", "image/webp", b"RIFF" + b"\x00" * 32),
    ]:
        res = _upload(client, user, name, ctype, data)
        assert res.status_code == 201, res.text
        assert res.json()["kind"] == "image"


def test_upload_rejects_disallowed_mime(client, db, uploads_dir):
    user = make_user(db, "u_up_c@t.com", "u_up_c")
    res = _upload(client, user, "nota.txt", "text/plain", b"hola")
    assert res.status_code == 400
    assert "Formato no permitido" in res.json()["detail"]


def test_upload_rejects_mismatched_extension(client, db, uploads_dir):
    """Un .png que se declara como image/jpeg no se acepta."""
    user = make_user(db, "u_up_d@t.com", "u_up_d")
    res = _upload(client, user, "foto.png", "image/jpeg", PNG_BYTES)
    assert res.status_code == 400
    assert "Extensión inválida" in res.json()["detail"]
    # Y el mensaje lista las extensiones correctas para ese MIME.
    detail = res.json()["detail"]
    assert ".jpg" in detail and ".jpeg" in detail
    assert ".png" not in detail


def test_upload_rejects_empty_file(client, db, uploads_dir):
    user = make_user(db, "u_up_e@t.com", "u_up_e")
    res = _upload(client, user, "vacio.png", "image/png", b"")
    assert res.status_code == 400
    assert "vacío" in res.json()["detail"]


def test_upload_requires_auth(client, db, uploads_dir):
    res = client.post(
        f"{BASE}/users/me/media",
        files={"file": ("a.png", PNG_BYTES, "image/png")},
    )
    assert res.status_code == 401


def test_upload_rejects_oversized_file(client, db, uploads_dir, monkeypatch):
    user = make_user(db, "u_up_f@t.com", "u_up_f")
    settings = get_settings()
    monkeypatch.setattr(settings, "max_upload_bytes", 10)
    res = _upload(client, user, "grande.png", "image/png", PNG_BYTES)
    assert res.status_code == 400
    assert "supera el máximo" in res.json()["detail"]


def test_uploaded_file_is_served(client, db, uploads_dir):
    """El archivo subido se puede descargar desde /uploads."""
    user = make_user(db, "u_up_g@t.com", "u_up_g")
    res = _upload(client, user, "portada.png", "image/png", PNG_BYTES)
    assert res.status_code == 201
    url = res.json()["url"]
    path = url.split("/uploads/")[1]

    served = client.get(f"/uploads/{path}")
    assert served.status_code == 200
    assert served.content == PNG_BYTES


def test_delete_upload_removes_the_file(client, db, uploads_dir):
    user = make_user(db, "u_up_h@t.com", "u_up_h")
    res = _upload(client, user, "borrar.png", "image/png", PNG_BYTES)
    url = res.json()["url"]

    res = client.delete(
        f"{BASE}/users/me/media",
        params={"url": url},
        headers=auth(user),
    )
    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert not list(uploads_dir.glob("*.png"))


def test_delete_unknown_upload_returns_404(client, db, uploads_dir):
    user = make_user(db, "u_up_i@t.com", "u_up_i")
    res = client.delete(
        f"{BASE}/users/me/media",
        params={"url": "http://127.0.0.1:8000/uploads/no_existe.png"},
        headers=auth(user),
    )
    assert res.status_code == 404

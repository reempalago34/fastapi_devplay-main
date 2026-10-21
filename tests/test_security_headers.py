"""Pruebas del cortafuegos de aplicación (cabeceras y hosts permitidos)."""

from fastapi.testclient import TestClient

from app.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_security_headers_present():
    response = _client().get("/")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert (
        response.headers["referrer-policy"]
        == "strict-origin-when-cross-origin"
    )
    assert "camera=()" in response.headers["permissions-policy"]
    assert response.headers["cross-origin-opener-policy"] == "same-origin"
    assert response.headers["cross-origin-resource-policy"] == "same-site"


def test_trusted_host_rejects_unknown_host():
    response = _client().get("/", headers={"Host": "evil.example"})

    assert response.status_code == 400


def test_cors_allows_frontend_origin():
    response = _client().options(
        "/api/v1/posts",
        headers={
            "Origin": "http://localhost:8080",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == "http://localhost:8080"
    )

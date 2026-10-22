"""Contrato con el cliente Flutter (repo frankalexander-GM/flutter-dev).

CORS: el cliente Flutter web corre en un puerto aleatorio, así que el API
tiene que aceptar cualquier origen localhost/127.0.0.1.
"""

from tests.factories import BASE

# ---------- CORS (el cliente Flutter web corre en un puerto aleatorio) ----------


def test_cors_allows_any_localhost_port(client):
    res = client.options(
        f"{BASE}/posts",
        headers={
            "Origin": "http://localhost:52341",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:52341"

"""Contrato con el cliente Flutter (repo frankalexander-GM/flutter-dev).

Motivos de reporte: el cliente Flutter define más de los que aceptaba el API
(`hate_speech`, `nsfw`, `copyright`... salían con 422).
"""

import pytest

from tests.factories import BASE, auth, make_user

# ---------- reportes ----------


@pytest.mark.parametrize(
    "reason",
    ["spam", "harassment", "inappropriate", "impersonation", "other", "hate_speech", "nsfw"],
)
def test_report_accepts_flutter_reasons(client, db, reason):
    """El cliente Flutter define más motivos de los que aceptaba el API."""
    alice = make_user(db, f"flutter_rep_{reason}@t.com", f"flutter_rep_{reason}")
    res = client.post(
        f"{BASE}/security/report",
        json={"type": "POST", "entityId": "x", "reason": reason},
        headers=auth(alice),
    )
    assert res.status_code == 200, res.text

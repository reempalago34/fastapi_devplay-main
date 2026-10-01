"""Tests del M1: seguridad y moderación (block, report, privacy, password,
login-events y borrado de cuenta en 3 pasos)."""

from sqlalchemy import select

from app.core.security import create_access_token, hash_password, verify_password
from app.models.chat import Notification
from app.models.social import Follow
from app.models.user import User

BASE = "/api/v1"


def make_user(db, email: str, username: str, password: str = "secret123") -> User:
    """Crea el usuario directamente en BD para no consumir el rate limit de
    /auth/register (5/min por IP) que ya usan los tests de auth."""
    user = User(
        email=email,
        username=username,
        password_hash=hash_password(password),
        full_name=username.title(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# ---------- requerir autenticación ----------


def test_security_endpoints_require_auth(client):
    checks = [
        client.post(f"{BASE}/security/block", json={"blockedId": "x"}),
        client.delete(f"{BASE}/security/block?blockedId=x"),
        client.get(f"{BASE}/security/block/list"),
        client.post(
            f"{BASE}/security/report",
            json={"type": "POST", "entityId": "e", "reason": "spam"},
        ),
        client.patch(f"{BASE}/security/privacy", json={"isPrivate": True}),
        client.post(
            f"{BASE}/security/password",
            json={"currentPassword": "a", "newPassword": "bbbbbb"},
        ),
        client.get(f"{BASE}/security/login-events"),
        client.post(f"{BASE}/security/account", json={"action": "request-code"}),
    ]
    for res in checks:
        assert res.status_code == 401, f"{res.request.url} -> {res.status_code}"


# ---------- bloqueos ----------


def test_block_and_unblock_flow(client, db):
    alice = make_user(db, "sec_alice@t.com", "sec_alice")
    bob = make_user(db, "sec_bob@t.com", "sec_bob")

    res = client.post(f"{BASE}/security/block", json={"blockedId": bob.id}, headers=auth(alice))
    assert res.status_code == 200, res.text
    assert res.json() == {"blocked": True}

    res = client.post(f"{BASE}/security/block", json={"blockedId": bob.id}, headers=auth(alice))
    assert res.status_code == 409

    res = client.get(f"{BASE}/security/block/list", headers=auth(alice))
    assert res.status_code == 200
    blocked = res.json()["blocked"]
    assert [b["username"] for b in blocked] == ["sec_bob"]
    assert blocked[0]["blockedAt"]

    res = client.delete(
        f"{BASE}/security/block?blockedId={bob.id}", headers=auth(alice)
    )
    assert res.status_code == 200
    assert res.json() == {"blocked": False}
    assert client.get(f"{BASE}/security/block/list", headers=auth(alice)).json()["blocked"] == []


def test_block_validation(client, db):
    alice = make_user(db, "sec_val@t.com", "sec_val")

    # no bloquearse a uno mismo
    res = client.post(f"{BASE}/security/block", json={"blockedId": alice.id}, headers=auth(alice))
    assert res.status_code == 400

    # usuario inexistente
    res = client.post(
        f"{BASE}/security/block", json={"blockedId": "no-existe"}, headers=auth(alice)
    )
    assert res.status_code == 404


def test_block_removes_mutual_follows(client, db):
    alice = make_user(db, "sec_mut_a@t.com", "sec_mut_a")
    bob = make_user(db, "sec_mut_b@t.com", "sec_mut_b")
    db.add(Follow(follower_id=alice.id, followee_id=bob.id))
    db.add(Follow(follower_id=bob.id, followee_id=alice.id))
    db.commit()

    res = client.post(f"{BASE}/security/block", json={"blockedId": bob.id}, headers=auth(alice))
    assert res.status_code == 200

    follows = db.scalars(
        select(Follow).where(
            (Follow.follower_id == alice.id) | (Follow.followee_id == alice.id)
        )
    ).all()
    assert follows == []
    db.expire_all()


# ---------- reportes ----------


def test_report_flow_and_duplicate(client, db):
    alice = make_user(db, "sec_rep_a@t.com", "sec_rep_a")
    bob = make_user(db, "sec_rep_b@t.com", "sec_rep_b")
    headers = auth(alice)

    payload = {"type": "USER", "entityId": bob.id, "reason": "spam", "description": "bot"}
    assert client.post(f"{BASE}/security/report", json=payload, headers=headers).status_code == 200

    # duplicado del mismo reporte
    assert (
        client.post(f"{BASE}/security/report", json=payload, headers=headers).status_code == 409
    )

    # datos inválidos
    res = client.post(
        f"{BASE}/security/report",
        json={"type": "X", "entityId": "y", "reason": "spam"},
        headers=headers,
    )
    assert res.status_code == 422


def test_report_rate_limit(client, db):
    alice = make_user(db, "sec_rl@t.com", "sec_rl")
    headers = auth(alice)
    for i in range(5):
        res = client.post(
            f"{BASE}/security/report",
            json={"type": "POST", "entityId": f"ent-{i}", "reason": "spam"},
            headers=headers,
        )
        assert res.status_code == 200, f"reporte {i}: {res.status_code}"
    res = client.post(
        f"{BASE}/security/report",
        json={"type": "POST", "entityId": "ent-99", "reason": "spam"},
        headers=headers,
    )
    assert res.status_code == 429


# ---------- privacidad ----------


def test_privacy_toggle(client, db):
    alice = make_user(db, "sec_priv@t.com", "sec_priv")
    headers = auth(alice)

    res = client.patch(f"{BASE}/security/privacy", json={"isPrivate": True}, headers=headers)
    assert res.status_code == 200
    assert res.json() == {"ok": True, "isPrivate": True}

    me = client.get(f"{BASE}/users/me", headers=headers).json()
    assert me["is_private"] is True

    res = client.patch(f"{BASE}/security/privacy", json={"isPrivate": False}, headers=headers)
    assert res.json()["isPrivate"] is False


# ---------- contraseña ----------


def test_change_password(client, db):
    alice = make_user(db, "sec_pw@t.com", "sec_pw", password="old-secret")
    headers = auth(alice)

    res = client.post(
        f"{BASE}/security/password",
        json={"currentPassword": "wrong-pass", "newPassword": "new-secret"},
        headers=headers,
    )
    assert res.status_code == 400

    res = client.post(
        f"{BASE}/security/password",
        json={"currentPassword": "old-secret", "newPassword": "new-secret"},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    db.expire_all()
    updated = db.scalar(select(User).where(User.id == alice.id))
    assert verify_password("new-secret", updated.password_hash)
    assert not verify_password("old-secret", updated.password_hash)

    note = db.scalar(select(Notification).where(Notification.user_id == alice.id))
    assert note is not None and "contraseña" in note.message.lower()


# ---------- eventos de login ----------


def test_login_events_are_recorded(client, db):
    alice = make_user(db, "sec_ev@t.com", "sec_ev", password="secret123")
    headers = auth(alice)

    # login fallido → genera LoginEvent
    client.post(f"{BASE}/auth/login", json={"email": alice.email, "password": "nope"})

    res = client.get(f"{BASE}/security/login-events", headers=headers)
    assert res.status_code == 200
    events = res.json()["events"]
    assert len(events) >= 1
    assert events[0]["success"] is False
    assert "createdAt" in events[0]


# ---------- borrado de cuenta ----------


def test_account_deletion_flow(client, db):
    alice = make_user(db, "sec_del@t.com", "sec_del", password="secret123")
    headers = auth(alice)

    # 1. pedir código
    res = client.post(f"{BASE}/security/account", json={"action": "request-code"}, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    assert body["email"].startswith("se") and "•" in body["email"]
    assert len(body["devCode"]) == 6
    code = body["devCode"]

    # 2. verificar código
    res = client.post(
        f"{BASE}/security/account",
        json={"action": "verify-code", "code": "000000"},
        headers=headers,
    )
    if code == "000000":  # colisión casi imposible, pero no romper el test
        pass
    else:
        assert res.status_code == 400

    res = client.post(
        f"{BASE}/security/account",
        json={"action": "verify-code", "code": code},
        headers=headers,
    )
    assert res.status_code == 200

    # 3. confirmar: frase incorrecta → 400
    res = client.post(
        f"{BASE}/security/account",
        json={"action": "confirm", "code": code, "password": "secret123", "confirm": "borrar"},
        headers=headers,
    )
    assert res.status_code == 400

    # contraseña incorrecta → 400
    res = client.post(
        f"{BASE}/security/account",
        json={
            "action": "confirm",
            "code": code,
            "password": "otra-clave",
            "confirm": "ELIMINAR MI CUENTA",
        },
        headers=headers,
    )
    assert res.status_code == 400

    # confirmación correcta → 200 y la cuenta desaparece
    res = client.post(
        f"{BASE}/security/account",
        json={
            "action": "confirm",
            "code": code,
            "password": "secret123",
            "confirm": "ELIMINAR MI CUENTA",
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text

    assert client.get(f"{BASE}/auth/me", headers=headers).status_code == 401
    db.expire_all()
    assert db.scalar(select(User).where(User.email == "sec_del@t.com")) is None


def test_account_rejects_invalid_action(client, db):
    alice = make_user(db, "sec_act@t.com", "sec_act")
    res = client.post(
        f"{BASE}/security/account", json={"action": "otra-cosa"}, headers=auth(alice)
    )
    assert res.status_code == 422

    res = client.post(
        f"{BASE}/security/account",
        json={"action": "verify-code", "code": "12"},  # no son 6 dígitos
        headers=auth(alice),
    )
    assert res.status_code == 422

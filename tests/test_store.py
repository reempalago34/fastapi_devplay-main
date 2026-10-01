"""Tests del M3: tienda DevCoins (catálogo, balance, compra, artículos)."""

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models.store import DevCoinTransaction, StoreItem, StorePurchase
from app.models.user import User
from tests.factories import BASE, auth, make_user


def make_item(db, name, price, category="powerup", icon="Zap", **kwargs) -> StoreItem:
    item = StoreItem(
        name=name,
        description=f"Descripción de {name}",
        price=price,
        category=category,
        icon=icon,
        **kwargs,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ---------- catálogo ----------


def test_items_catalog_is_public_and_grouped(client, db):
    db.add_all(
        [
            StoreItem(name="Boost", description="x", price=50, category="powerup", icon="Zap"),
            StoreItem(name="Turbo", description="x", price=20, category="powerup", icon="Zap"),
            StoreItem(name="Marco", description="x", price=30, category="avatar", icon="Smile"),
            StoreItem(name="Pro", description="x", price=100, category="premium", icon="Crown"),
        ]
    )
    db.commit()

    res = client.get(f"{BASE}/store/items")  # sin token
    assert res.status_code == 200, res.text
    body = res.json()

    # orden: categoría asc, precio asc
    assert [i["category"] for i in body["items"]] == [
        "avatar",
        "powerup",
        "powerup",
        "premium",
    ]
    powerups = body["grouped"]["powerup"]
    assert [p["name"] for p in powerups] == ["Turbo", "Boost"]

    # las 4 categorías base siempre presentes, aunque vacías
    assert set(body["grouped"]) == {"powerup", "avatar", "premium", "bundle"}
    assert body["grouped"]["bundle"] == []
    assert body["items"][0]["imageUrl"] is None
    assert body["items"][0]["createdAt"]


def test_items_grouped_is_consistent(client, db):
    """Agrupa todo lo del catálogo y siempre expone las 4 categorías base."""
    body = client.get(f"{BASE}/store/items").json()
    assert set(body["grouped"]) >= {"powerup", "avatar", "premium", "bundle"}
    grouped_ids = [i["id"] for items in body["grouped"].values() for i in items]
    assert sorted(grouped_ids) == sorted(i["id"] for i in body["items"])


# ---------- balance ----------


def test_balance(client, db):
    # anónimo → 0 y lista vacía
    assert client.get(f"{BASE}/store/balance").json() == {"balance": 0, "transactions": []}

    alice = make_user(db, "store_bal@t.com", "store_bal")  # devCoins inicial = 100
    headers = auth(alice)

    body = client.get(f"{BASE}/store/balance", headers=headers).json()
    assert body == {"balance": 100, "transactions": []}

    db.add(
        DevCoinTransaction(
            user_id=alice.id, amount=-25, type="purchase", description="Compra: Boost"
        )
    )
    db.commit()

    body = client.get(f"{BASE}/store/balance", headers=headers).json()
    assert body["balance"] == 100
    assert len(body["transactions"]) == 1
    tx = body["transactions"][0]
    assert tx["amount"] == -25
    assert tx["userId"] == alice.id
    assert tx["createdAt"]

    # máximo 20 transacciones, más recientes primero
    for i in range(25):
        db.add(
            DevCoinTransaction(
                user_id=alice.id, amount=1, type="reward", description=f"r{i}"
            )
        )
    db.commit()
    body = client.get(f"{BASE}/store/balance", headers=headers).json()
    assert len(body["transactions"]) == 20
    assert body["transactions"][0]["description"] == "r24"


# ---------- compra ----------


def test_buy_flow(client, db):
    alice = make_user(db, "store_buy@t.com", "store_buy")
    item = make_item(db, "Boost", price=30)
    headers = auth(alice)

    res = client.post(f"{BASE}/store/buy", json={"itemId": item.id}, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert body["balance"] == 70  # 100 iniciales - 30
    assert body["purchase"]["pricePaid"] == 30
    assert body["purchase"]["itemId"] == item.id
    assert body["purchase"]["item"]["name"] == "Boost"
    assert body["purchase"]["createdAt"]
    assert body["transaction"]["amount"] == -30
    assert body["transaction"]["type"] == "purchase"
    assert body["transaction"]["description"] == "Compra: Boost"

    db.expire_all()
    assert db.scalar(
        select(func.count()).select_from(StorePurchase).where(
            StorePurchase.user_id == alice.id
        )
    ) == 1
    assert db.scalar(select(User.dev_coins).where(User.id == alice.id)) == 70

    # repetir la compra → 400 y no descuenta otra vez
    res = client.post(f"{BASE}/store/buy", json={"itemId": item.id}, headers=headers)
    assert res.status_code == 400
    assert "Ya posees" in res.json()["detail"]
    db.expire_all()
    assert db.scalar(
        select(func.count()).select_from(StorePurchase).where(
            StorePurchase.user_id == alice.id
        )
    ) == 1

    # balance queda en 70
    body = client.get(f"{BASE}/store/balance", headers=headers).json()
    assert body["balance"] == 70

    # el artículo aparece en my-items con su ficha
    body = client.get(f"{BASE}/store/my-items", headers=headers).json()
    assert len(body["items"]) == 1
    owned = body["items"][0]
    assert owned["itemId"] == item.id
    assert owned["item"]["name"] == "Boost"
    assert owned["item"]["price"] == 30
    assert owned["item"]["category"] == "powerup"


def test_buy_requires_auth_and_valid_input(client, db):
    item = make_item(db, "SoloAuth", price=10)

    assert client.post(f"{BASE}/store/buy", json={"itemId": item.id}).status_code == 401

    alice = make_user(db, "store_in@t.com", "store_in")
    headers = auth(alice)
    assert client.post(f"{BASE}/store/buy", json={}, headers=headers).status_code == 422
    res = client.post(f"{BASE}/store/buy", json={"itemId": "no-existe"}, headers=headers)
    assert res.status_code == 404
    assert "Artículo no encontrado" in res.json()["detail"]


def test_buy_insufficient_funds(client, db):
    alice = make_user(db, "store_poor@t.com", "store_poor")
    alice.dev_coins = 10
    db.commit()
    item = make_item(db, "Caro", price=30)

    res = client.post(f"{BASE}/store/buy", json={"itemId": item.id}, headers=auth(alice))
    assert res.status_code == 400
    assert "Necesitas 20 DevCoins más" in res.json()["detail"]

    db.expire_all()
    assert db.scalar(
        select(func.count()).select_from(StorePurchase).where(
            StorePurchase.user_id == alice.id
        )
    ) == 0


def test_buy_forbidden_for_guests(client, db):
    guest = make_user(db, "store_guest@t.com", "store_guest")
    guest.is_guest = True
    db.commit()
    item = make_item(db, "Invitado", price=10)

    res = client.post(f"{BASE}/store/buy", json={"itemId": item.id}, headers=auth(guest))
    assert res.status_code == 403
    assert "invitados" in res.json()["detail"].lower()


def test_buy_rate_limit(client, db):
    alice = make_user(db, "store_rl@t.com", "store_rl")
    item = make_item(db, "Rapido", price=1)
    headers = auth(alice)

    codes = [
        client.post(f"{BASE}/store/buy", json={"itemId": item.id}, headers=headers).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [200] + [400] * 9  # 1ª compra, resto ya poseído
    assert codes[10] == 429  # límite: 10/min por usuario


def test_my_items_anonymous_returns_empty(client, db):
    assert client.get(f"{BASE}/store/my-items").json() == {"items": []}


def test_store_purchase_unique_constraint(db):
    """Paridad con @@unique([userId, itemId]) de Prisma (migración er_)."""
    user = make_user(db, "store_uni@t.com", "store_uni")
    item = make_item(db, "Único", price=5)
    db.add(StorePurchase(user_id=user.id, item_id=item.id, price_paid=5))
    db.commit()

    db.add(StorePurchase(user_id=user.id, item_id=item.id, price_paid=5))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

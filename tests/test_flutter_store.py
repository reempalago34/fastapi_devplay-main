"""Contrato con el cliente Flutter (repo frankalexander-GM/flutter-dev).

La tienda: el cliente Flutter lee `categories`, `dev_coins`, `new_balance` y los
items aplanados de `my-items` (si no, revienta al parsear `name`).
"""

from app.models.store import StoreItem
from tests.factories import BASE, auth, make_user


def make_item(db, name: str, price: int, category: str = "powerup") -> StoreItem:
    item = StoreItem(
        name=name,
        description=f"Descripción de {name}",
        price=price,
        category=category,
        icon="Zap",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ---------- tienda: el formato que espera Flutter ----------


def test_store_items_expose_categories(client, db):
    """Flutter lee `categories` (lista de {id, name, icon, items})."""
    make_item(db, "Boost F", 50, "powerup")
    make_item(db, "Marco F", 30, "avatar")

    body = client.get(f"{BASE}/store/items").json()

    assert "categories" in body
    ids = [c["id"] for c in body["categories"]]
    assert {"powerup", "avatar", "premium", "bundle"} <= set(ids)

    powerup = next(c for c in body["categories"] if c["id"] == "powerup")
    assert powerup["name"]
    assert powerup["icon"]
    assert any(i["name"] == "Boost F" for i in powerup["items"])

    # la lista plana y el agrupado siguen ahí (los usa el frontend Next.js)
    assert any(i["name"] == "Boost F" for i in body["items"])
    assert body["grouped"]["powerup"]


def test_store_balance_aliases(client, db):
    """Flutter lee `dev_coins` y `recent_transactions`."""
    alice = make_user(db, "flutter_bal@t.com", "flutter_bal")
    body = client.get(f"{BASE}/store/balance", headers=auth(alice)).json()

    assert body["dev_coins"] == 100
    assert body["balance"] == 100
    assert body["recent_transactions"] == []


def test_store_buy_returns_item_and_new_balance(client, db):
    """Flutter lee `new_balance` y `item` de la respuesta de la compra."""
    alice = make_user(db, "flutter_buy@t.com", "flutter_buy")
    item = make_item(db, "Boost F2", 30)
    headers = auth(alice)

    body = client.post(f"{BASE}/store/buy", json={"itemId": item.id}, headers=headers).json()

    assert body["success"] is True
    assert body["new_balance"] == 70
    assert body["item"]["name"] == "Boost F2"
    assert body["item"]["price"] == 30
    assert body["item"]["category"] == "powerup"
    assert body["message"]


def test_store_my_items_are_flattened_for_flutter(client, db):
    """Flutter parsea `items` como una lista de items de tienda (name, price...)."""
    alice = make_user(db, "flutter_my@t.com", "flutter_my")
    item = make_item(db, "Boost F2", 30)
    headers = auth(alice)
    client.post(f"{BASE}/store/buy", json={"itemId": item.id}, headers=headers)

    body = client.get(f"{BASE}/store/my-items", headers=headers).json()
    assert len(body["items"]) == 1
    owned = body["items"][0]

    # campos que Flutter lee del item (sin anidar)
    assert owned["name"] == "Boost F2"
    assert owned["price"] == 30
    assert owned["category"] == "powerup"
    assert owned["icon"]
    assert owned["is_owned"] is True

    # y la ficha anidada que usa el frontend Next.js
    assert owned["item"]["name"] == "Boost F2"
    assert owned["itemId"] == item.id
    assert owned["pricePaid"] == 30

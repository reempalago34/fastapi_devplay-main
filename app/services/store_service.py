"""Tienda DevCoins: catálogo, balance, compra y artículos propios.

Port desde devplay-main/src/app/api/devplay/store/*/route.ts
"""

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.store import DevCoinTransaction, StoreItem, StorePurchase
from app.models.user import User
from app.schemas.store import PurchaseOut, StoreCategoryOut, StoreItemOut
from app.utils.rate_limit import check_rate_limit

# Categorías fijas del original (siempre presentes en `grouped`, aunque vacías)
BASE_CATEGORIES = ("powerup", "avatar", "premium", "bundle")

# Nombre e icono de cada categoría (el cliente Flutter los usa como pestañas)
CATEGORY_META = {
    "powerup": ("Power-ups", "flash_on"),
    "avatar": ("Avatar", "image"),
    "premium": ("Premium", "workspace_premium"),
    "bundle": ("Bundle", "campaign"),
}


def _item_out(item: StoreItem, is_owned: bool = False) -> StoreItemOut:
    out = StoreItemOut.model_validate(item)
    out.is_owned = is_owned
    return out


def _purchase_out(purchase: StorePurchase, item: StoreItem) -> PurchaseOut:
    """Compra con la ficha anidada y también con sus campos aplanados."""
    item_out = _item_out(item)
    return PurchaseOut(
        id=purchase.id,
        user_id=purchase.user_id,
        item_id=purchase.item_id,
        price_paid=purchase.price_paid,
        created_at=purchase.created_at,
        item=item_out,
        name=item_out.name,
        description=item_out.description,
        price=item_out.price,
        category=item_out.category,
        icon=item_out.icon,
        rarity=item_out.rarity,
        is_owned=True,
    )


def list_items(db, user_id: str | None = None) -> dict:
    items = db.scalars(
        select(StoreItem).order_by(StoreItem.category, StoreItem.price)
    ).all()

    owned: set[str] = set()
    if user_id is not None:
        owned = set(
            db.scalars(
                select(StorePurchase.item_id).where(StorePurchase.user_id == user_id)
            )
        )

    grouped: dict[str, list[StoreItem]] = {key: [] for key in BASE_CATEGORIES}
    for item in items:
        grouped.setdefault(item.category, []).append(item)

    categories = [
        StoreCategoryOut(
            id=key,
            name=CATEGORY_META.get(key, (key.capitalize(), "shopping_bag"))[0],
            icon=CATEGORY_META.get(key, (key.capitalize(), "shopping_bag"))[1],
            items=[
                _item_out(item, is_owned=item.id in owned)
                for item in grouped.get(key, [])
            ],
        )
        for key in BASE_CATEGORIES
    ]

    return {
        "items": [_item_out(item, is_owned=item.id in owned) for item in items],
        "grouped": grouped,
        "categories": categories,
    }


def get_balance(db, user_id: str | None) -> dict:
    if user_id is None:
        return {
            "balance": 0,
            "dev_coins": 0,
            "transactions": [],
            "recent_transactions": [],
        }

    balance = db.scalar(select(User.dev_coins).where(User.id == user_id)) or 0
    transactions = db.scalars(
        select(DevCoinTransaction)
        .where(DevCoinTransaction.user_id == user_id)
        .order_by(DevCoinTransaction.created_at.desc())
        .limit(20)
    ).all()
    return {
        "balance": balance,
        "dev_coins": balance,
        "transactions": transactions,
        "recent_transactions": transactions,
    }


def buy_item(db, user_id: str, item_id: str) -> dict:
    # Anti-abuso: máx. 10 compras por usuario cada minuto
    check_rate_limit(f"buy:{user_id}", limit=10, window_seconds=60)

    item = db.get(StoreItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Artículo no encontrado")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if user.is_guest:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Los invitados no pueden comprar. Crea una cuenta para continuar.",
        )

    owned = db.scalar(
        select(StorePurchase).where(
            StorePurchase.user_id == user_id, StorePurchase.item_id == item_id
        )
    )
    if owned is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ya posees este artículo")

    if user.dev_coins < item.price:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Necesitas {item.price - user.dev_coins} DevCoins más para comprar este artículo",
        )

    # Débito atómico: evita doble gasto si dos compras llegan a la vez
    result = db.execute(
        update(User)
        .where(User.id == user_id, User.dev_coins >= item.price)
        .values(dev_coins=User.dev_coins - item.price)
    )
    if result.rowcount == 0:
        db.rollback()
        db.expire(user)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Necesitas {max(item.price - user.dev_coins, 0)} DevCoins más"
            " para comprar este artículo",
        )

    purchase = StorePurchase(user_id=user_id, item_id=item_id, price_paid=item.price)
    db.add(purchase)
    try:
        db.flush()  # la unique (userId, itemId) atrapa carreras entre peticiones
    except IntegrityError as err:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ya posees este artículo") from err

    transaction = DevCoinTransaction(
        user_id=user_id,
        amount=-item.price,
        type="purchase",
        description=f"Compra: {item.name}",
    )
    db.add(transaction)
    db.commit()

    balance = db.scalar(select(User.dev_coins).where(User.id == user_id)) or 0
    item_out = _item_out(item)
    return {
        "success": True,
        "purchase": _purchase_out(purchase, item),
        "transaction": transaction,
        "balance": balance,
        "new_balance": balance,
        "item": item_out,
        "message": f"Compra realizada: {item.name}",
    }


def my_items(db, user_id: str) -> list[PurchaseOut]:
    purchases = db.scalars(
        select(StorePurchase)
        .where(StorePurchase.user_id == user_id)
        .options(selectinload(StorePurchase.item))
        .order_by(StorePurchase.created_at.desc())
    ).all()
    return [_purchase_out(p, p.item) for p in purchases]

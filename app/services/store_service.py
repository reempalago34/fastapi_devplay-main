"""Tienda DevCoins: catálogo, balance, compra y artículos propios.

Port desde devplay-main/src/app/api/devplay/store/*/route.ts
"""

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.store import DevCoinTransaction, StoreItem, StorePurchase
from app.models.user import User
from app.schemas.store import PurchaseOut, StoreItemOut
from app.utils.rate_limit import check_rate_limit

# Categorías fijas del original (siempre presentes en `grouped`, aunque vacías)
BASE_CATEGORIES = ("powerup", "avatar", "premium", "bundle")


def list_items(db) -> dict:
    items = db.scalars(
        select(StoreItem).order_by(StoreItem.category, StoreItem.price)
    ).all()

    grouped: dict[str, list[StoreItem]] = {key: [] for key in BASE_CATEGORIES}
    for item in items:
        grouped.setdefault(item.category, []).append(item)

    return {"items": items, "grouped": grouped}


def get_balance(db, user_id: str | None) -> dict:
    if user_id is None:
        return {"balance": 0, "transactions": []}

    balance = db.scalar(select(User.dev_coins).where(User.id == user_id)) or 0
    transactions = db.scalars(
        select(DevCoinTransaction)
        .where(DevCoinTransaction.user_id == user_id)
        .order_by(DevCoinTransaction.created_at.desc())
        .limit(20)
    ).all()
    return {"balance": balance, "transactions": transactions}


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
    return {
        "success": True,
        "purchase": PurchaseOut(
            id=purchase.id,
            user_id=purchase.user_id,
            item_id=purchase.item_id,
            price_paid=purchase.price_paid,
            created_at=purchase.created_at,
            item=StoreItemOut.model_validate(item),
        ),
        "transaction": transaction,
        "balance": balance,
    }


def my_items(db, user_id: str) -> list[PurchaseOut]:
    purchases = db.scalars(
        select(StorePurchase)
        .where(StorePurchase.user_id == user_id)
        .options(selectinload(StorePurchase.item))
        .order_by(StorePurchase.created_at.desc())
    ).all()
    return [
        PurchaseOut(
            id=p.id,
            user_id=p.user_id,
            item_id=p.item_id,
            price_paid=p.price_paid,
            created_at=p.created_at,
            item=StoreItemOut.model_validate(p.item),
        )
        for p in purchases
    ]

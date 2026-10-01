from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.user import User
from app.schemas.store import (
    BalanceResponse,
    BuyRequest,
    BuyResponse,
    ItemsResponse,
    MyItemsResponse,
)
from app.services import store_service as svc

router = APIRouter(prefix="/store", tags=["store"])


@router.get("/items", response_model=ItemsResponse)
def list_items(db: Session = Depends(get_db)):
    """Catálogo completo agrupado por categoría (lectura anónima)."""
    return svc.list_items(db)


@router.get("/balance", response_model=BalanceResponse)
def balance(
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Balance de DevCoins + 20 transacciones recientes (anónimo → 0 y [])."""
    user_id = user.id if user else None
    return BalanceResponse(**svc.get_balance(db, user_id))


@router.post("/buy", response_model=BuyResponse)
def buy(
    payload: BuyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compra un artículo (máx. 10/min). Descuenta monedas de forma atómica."""
    return BuyResponse(**svc.buy_item(db, user.id, payload.item_id))


@router.get("/my-items", response_model=MyItemsResponse)
def my_items(
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Artículos comprados con su ficha (anónimo → lista vacía)."""
    items = svc.my_items(db, user.id) if user else []
    return MyItemsResponse(items=items)

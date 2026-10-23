from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field


class StoreItemOut(BaseModel):
    id: str
    name: str
    description: str
    price: int
    category: str
    icon: str
    image_url: str | None = Field(default=None, alias="imageUrl")
    effect: str | None = None
    duration: int | None = None
    created_at: datetime = Field(alias="createdAt")
    # Campos que usa el cliente Flutter para pintar la rareza y el estado.
    rarity: str = "common"
    is_owned: bool = False

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def isOwned(self) -> bool:
        """Alias en camelCase (el frontend Next.js usa esa clave)."""
        return self.is_owned


class StoreCategoryOut(BaseModel):
    """Categoría de la tienda (la usan las pestañas del cliente Flutter)."""

    id: str
    name: str
    icon: str
    items: list[StoreItemOut] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class ItemsResponse(BaseModel):
    """Catálogo: lista plana, agrupado por clave y por categoría."""

    items: list[StoreItemOut]
    grouped: dict[str, list[StoreItemOut]]
    categories: list[StoreCategoryOut] = Field(default_factory=list)


class BalanceTransaction(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    amount: int
    type: str
    description: str
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def createdAt(self) -> datetime:
        """Alias en camelCase (lo consume el frontend Next.js)."""
        return self.created_at


class BalanceResponse(BaseModel):
    """Saldo de DevCoins + movimientos recientes."""

    balance: int
    # Alias del saldo: el cliente Flutter lo lee como `dev_coins`.
    dev_coins: int = 0
    transactions: list[BalanceTransaction] = Field(default_factory=list)
    # Alias de la lista de movimientos (el cliente Flutter lo lee así).
    recent_transactions: list[BalanceTransaction] = Field(default_factory=list)


class BuyRequest(BaseModel):
    item_id: str = Field(alias="itemId", min_length=1)

    model_config = ConfigDict(populate_by_name=True)


class PurchaseOut(BaseModel):
    """Compra realizada.

    Incluye la ficha anidada (`item`) y también sus campos aplanados: el
    cliente Flutter parsea esta lista como una lista de items de tienda.
    """

    id: str
    user_id: str = Field(alias="userId")
    item_id: str = Field(alias="itemId")
    price_paid: int = Field(alias="pricePaid")
    created_at: datetime = Field(alias="createdAt")
    item: StoreItemOut
    # --- Campos aplanados del item (compat con el cliente Flutter) ---
    name: str = ""
    description: str = ""
    price: int = 0
    category: str = ""
    icon: str = ""
    rarity: str = "common"
    is_owned: bool = True

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def isOwned(self) -> bool:
        """Alias en camelCase (el frontend Next.js usa esa clave)."""
        return self.is_owned


class BuyResponse(BaseModel):
    success: bool
    purchase: PurchaseOut
    transaction: BalanceTransaction
    balance: int
    # --- Alias que usa el cliente Flutter ---
    new_balance: int = 0
    item: StoreItemOut | None = None
    message: str | None = None


class MyItemsResponse(BaseModel):
    items: list[PurchaseOut]

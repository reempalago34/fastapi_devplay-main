from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ItemsResponse(BaseModel):
    items: list[StoreItemOut]
    grouped: dict[str, list[StoreItemOut]]


class BalanceTransaction(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    amount: int
    type: str
    description: str
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class BalanceResponse(BaseModel):
    balance: int
    transactions: list[BalanceTransaction]


class BuyRequest(BaseModel):
    item_id: str = Field(alias="itemId", min_length=1)

    model_config = ConfigDict(populate_by_name=True)


class PurchaseOut(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    item_id: str = Field(alias="itemId")
    price_paid: int = Field(alias="pricePaid")
    created_at: datetime = Field(alias="createdAt")
    item: StoreItemOut

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class BuyResponse(BaseModel):
    success: bool
    purchase: PurchaseOut
    transaction: BalanceTransaction
    balance: int


class MyItemsResponse(BaseModel):
    items: list[PurchaseOut]

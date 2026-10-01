from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, id_pk


class StoreItem(Base, CreatedAtMixin):
    __tablename__ = "StoreItem"
    __table_args__ = (Index("ix_StoreItem_category", "category"),)

    id: Mapped[str] = id_pk()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)  # en DevCoins
    category: Mapped[str] = mapped_column(String(16), nullable=False)
    icon: Mapped[str] = mapped_column(String(64), nullable=False)  # nombre Lucide
    image_url: Mapped[str | None] = mapped_column("imageUrl", Text)
    effect: Mapped[str | None] = mapped_column(String(64))
    duration: Mapped[int | None] = mapped_column(Integer)  # días; NULL = permanente

    purchases = relationship("StorePurchase", back_populates="item", lazy="select")


class StorePurchase(Base, CreatedAtMixin):
    __tablename__ = "StorePurchase"
    __table_args__ = (
        UniqueConstraint("userId", "itemId", name="StorePurchase_userId_itemId_key"),
        Index("ix_StorePurchase_userId", "userId"),
    )

    id: Mapped[str] = id_pk()
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    item_id: Mapped[str] = mapped_column(
        "itemId",
        String(40),
        ForeignKey("StoreItem.id", ondelete="CASCADE"),
        nullable=False,
    )
    price_paid: Mapped[int] = mapped_column("pricePaid", Integer, nullable=False)

    user = relationship("User", back_populates="store_purchases")
    item = relationship("StoreItem", back_populates="purchases")


class DevCoinTransaction(Base, CreatedAtMixin):
    __tablename__ = "DevCoinTransaction"
    __table_args__ = (Index("ix_DevCoinTransaction_userId", "userId"),)

    id: Mapped[str] = id_pk()
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # negativo = gasto
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    user = relationship("User", back_populates="coin_transactions")

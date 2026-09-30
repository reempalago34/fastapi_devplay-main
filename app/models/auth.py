from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, id_pk


class LoginCode(Base, CreatedAtMixin):
    """Código de 6 dígitos de un solo uso enviado por correo."""

    __tablename__ = "LoginCode"
    __table_args__ = (Index("ix_LoginCode_userId_createdAt", "userId", "createdAt"),)

    id: Mapped[str] = id_pk()
    user_id: Mapped[str] = mapped_column(
        "userId", String(40), ForeignKey("User.id", ondelete="CASCADE"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column("codeHash", String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        "expiresAt", DateTime(timezone=True), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column("usedAt", DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="login_codes")


class AccountDeletionCode(Base, CreatedAtMixin):
    __tablename__ = "AccountDeletionCode"
    __table_args__ = (Index("ix_AccountDeletionCode_userId", "userId"),)

    id: Mapped[str] = id_pk()
    user_id: Mapped[str] = mapped_column(
        "userId", String(40), ForeignKey("User.id", ondelete="CASCADE"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column("codeHash", String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        "expiresAt", DateTime(timezone=True), nullable=False
    )
    consumed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="deletion_codes")


class LoginEvent(Base, CreatedAtMixin):
    """Auditoría de accesos. Nota: en devplay-main esta tabla nunca se escribía."""

    __tablename__ = "LoginEvent"
    __table_args__ = (
        Index("ix_LoginEvent_userId", "userId"),
        Index("ix_LoginEvent_createdAt", "createdAt"),
    )

    id: Mapped[str] = id_pk()
    user_id: Mapped[str | None] = mapped_column(
        "userId", String(40), ForeignKey("User.id", ondelete="SET NULL")
    )
    email: Mapped[str | None] = mapped_column(String(255))
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column("userAgent", String(512))

    user = relationship("User", back_populates="login_events")

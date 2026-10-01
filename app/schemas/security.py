from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import ReportReason, ReportType
from app.schemas.base import ORMModel
from app.utils.json_fields import loads_json


def _parse_tags(value):
    if isinstance(value, str):
        parsed = loads_json(value, [])
        return parsed if isinstance(parsed, list) else []
    return value


class BlockRequest(BaseModel):
    blocked_id: str = Field(alias="blockedId", min_length=1)

    model_config = ConfigDict(populate_by_name=True)


class BlockResponse(BaseModel):
    blocked: bool


class BlockedUser(BaseModel):
    id: str
    username: str
    avatar: str | None = None
    bio: str | None = None
    role: str
    tags: list[str] | None = None
    blocked_at: datetime = Field(alias="blockedAt")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, value):
        return _parse_tags(value)


class BlockListResponse(BaseModel):
    blocked: list[BlockedUser]


class ReportRequest(BaseModel):
    type: ReportType
    entity_id: str = Field(alias="entityId", min_length=1)
    reason: ReportReason
    description: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(populate_by_name=True)


class OkResponse(BaseModel):
    ok: Literal[True] = True


class PrivacyRequest(BaseModel):
    is_private: bool = Field(alias="isPrivate")

    model_config = ConfigDict(populate_by_name=True)


class PrivacyResponse(BaseModel):
    ok: Literal[True] = True
    is_private: bool = Field(alias="isPrivate")

    model_config = ConfigDict(populate_by_name=True)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(alias="currentPassword", min_length=1, max_length=100)
    new_password: str = Field(alias="newPassword", min_length=6, max_length=100)

    model_config = ConfigDict(populate_by_name=True)


class LoginEventOut(ORMModel):
    id: str
    email: str | None = None
    success: bool
    ip: str | None = None
    user_agent: str | None = Field(default=None, alias="userAgent")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class LoginEventsResponse(BaseModel):
    events: list[LoginEventOut]


# --- Borrado de cuenta en 3 pasos ---


class AccountRequestCode(BaseModel):
    action: Literal["request-code"]


class AccountVerifyCode(BaseModel):
    action: Literal["verify-code"]
    code: str = Field(pattern=r"^\d{6}$")


class AccountConfirm(BaseModel):
    action: Literal["confirm"]
    code: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=1, max_length=100)
    confirm: str = Field(min_length=1, max_length=64)


AccountAction = Annotated[
    AccountRequestCode | AccountVerifyCode | AccountConfirm,
    Field(discriminator="action"),
]


class AccountCodeResponse(BaseModel):
    ok: Literal[True] = True
    email: str
    expires_at: datetime = Field(alias="expiresAt")
    dev_code: str | None = Field(default=None, alias="devCode")

    model_config = ConfigDict(populate_by_name=True)

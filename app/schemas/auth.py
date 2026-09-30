
from pydantic import BaseModel, ConfigDict, EmailStr, Field

USERNAME_PATTERN = r"^[a-zA-Z0-9_]+$"


class RegisterRequest(BaseModel):
    """Paridad con devplay-main/src/app/api/devplay/auth/register/route.ts."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=20, pattern=USERNAME_PATTERN)
    password: str = Field(min_length=6, max_length=100)
    full_name: str = Field(alias="fullName", min_length=3, max_length=30)
    age: int = Field(ge=13, le=120)  # Ley 1581 art. 7: mínimo 13 años
    website: str | None = Field(default=None, max_length=200)  # honeypot anti-bots

    model_config = ConfigDict(populate_by_name=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=100)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ProfileUpdateRequest(BaseModel):
    """Paridad con PATCH /users/me/profile de devplay-main."""

    full_name: str | None = Field(default=None, alias="fullName", min_length=3, max_length=30)
    bio: str | None = Field(default=None, max_length=500)
    avatar: str | None = None
    banner: str | None = None
    location: str | None = Field(default=None, max_length=255)
    website: str | None = Field(default=None, max_length=255)
    profession: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = Field(default=None, max_length=15)
    language: str | None = Field(default=None, pattern=r"^(es|en)$")

    model_config = ConfigDict(populate_by_name=True)

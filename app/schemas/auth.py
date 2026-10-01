
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


# ------------------ Registro con código de 6 dígitos -----------------------


class RegisterResponse(BaseModel):
    """Registro ya NO crea sesión: manda un código de confirmación por correo."""

    ok: bool = True
    id: str
    username: str
    sent_to: str = Field(alias="sentTo")
    demo_code: str | None = Field(default=None, alias="demoCode")

    model_config = ConfigDict(populate_by_name=True)


class VerifyRegisterRequest(BaseModel):
    """{ email, code } verifica · { email, resend: true } reenvía."""

    email: EmailStr
    code: str | None = Field(default=None, pattern=r"^\d{6}$")
    resend: bool = False

    model_config = ConfigDict(populate_by_name=True)


class VerifyRegisterResponse(BaseModel):
    ok: bool = True
    username: str | None = None
    sent_to: str | None = Field(default=None, alias="sentTo")
    demo_code: str | None = Field(default=None, alias="demoCode")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------- Recuperación de contraseña ------------------------


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    ok: bool = True
    message: str
    sent_to: str | None = Field(default=None, alias="sentTo")
    demo_code: str | None = Field(default=None, alias="demoCode")

    model_config = ConfigDict(populate_by_name=True)


class ResetPasswordRequest(BaseModel):
    """Camino nuevo {email, code, password} o legacy {token, password}."""

    email: EmailStr | None = None
    code: str | None = Field(default=None, pattern=r"^\d{6}$")
    password: str = Field(min_length=6, max_length=100)
    token: str | None = Field(default=None, min_length=10, max_length=255)

    model_config = ConfigDict(populate_by_name=True)


class OkMessageResponse(BaseModel):
    ok: bool = True
    message: str


# -------------------------------- Invitados --------------------------------


class GuestRequest(BaseModel):
    username: str | None = Field(default=None, max_length=20)


class GuestResponse(BaseModel):
    id: str
    username: str
    is_guest: bool = Field(alias="isGuest")
    # Extra respecto a devplay-main: la API es stateless (JWT) y los invitados
    # no pueden usar /auth/login, así que se les entrega la sesión aquí.
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

    model_config = ConfigDict(populate_by_name=True)


# ------------------------------ Realtime ----------------------------------


class RealtimeTokenResponse(BaseModel):
    token: str
    expires_in: int = Field(alias="expiresIn")

    model_config = ConfigDict(populate_by_name=True)

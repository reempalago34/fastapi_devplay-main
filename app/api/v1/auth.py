from fastapi import APIRouter, Depends, HTTPException, Request, status
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, decode_token
from app.models.auth import LoginEvent
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserMe
from app.services.auth_service import (
    EmailTakenError,
    UsernameTakenError,
    authenticate,
    issue_tokens,
    register_user,
)
from app.utils.rate_limit import check_rate_limit
from app.utils.request import get_client_ip

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthResponse(TokenResponse):
    user: UserMe


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Crea la cuenta y devuelve tokens.

    En devplay-main este paso además envía un código de 6 dígitos por correo
    (LoginCode) que hay que verificar antes de entrar. Aquí la base devuelve la
    sesión directamente; el paso de verificación queda como tarea de la Fase 1.
    """
    ip = get_client_ip(request)
    check_rate_limit(f"register:{ip}", limit=5, window_seconds=60)

    try:
        user = register_user(db, payload)
    except EmailTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from None
    except UsernameTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken") from None

    tokens = issue_tokens(user)
    return AuthResponse(**tokens.model_dump(), user=UserMe.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    check_rate_limit(f"login:{ip}", limit=10, window_seconds=60)

    user = authenticate(db, payload.email, payload.password)
    if user is None:
        db.add(
            LoginEvent(
                email=payload.email.lower(),
                success=False,
                ip=ip,
                user_agent=request.headers.get("user-agent"),
            )
        )
        db.commit()
        # Mensaje genérico: no revela si el email existe o no (anti-enumeración)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials") from None

    db.add(
        LoginEvent(
            user_id=user.id,
            email=user.email,
            success=True,
            ip=ip,
            user_agent=request.headers.get("user-agent"),
        )
    )
    db.commit()

    tokens = issue_tokens(user)
    return AuthResponse(**tokens.model_dump(), user=UserMe.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest):
    try:
        user_id = decode_token(payload.refresh_token, expected_type="refresh")
    except InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from None
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=payload.refresh_token,
    )


@router.get("/me", response_model=UserMe)
def me(user: User = Depends(get_current_user)):
    return user

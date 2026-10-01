from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, decode_token
from app.models.auth import LoginEvent
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GuestRequest,
    GuestResponse,
    LoginRequest,
    OkMessageResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    TokenResponse,
    VerifyRegisterRequest,
    VerifyRegisterResponse,
)
from app.schemas.user import UserMe
from app.services.auth_service import (
    EmailTakenError,
    UsernameTakenError,
    authenticate,
    create_guest,
    find_verifiable_user,
    forgot_password,
    issue_tokens,
    reset_password,
    send_verification_code,
    start_registration,
    verify_register,
    welcome_email,
)
from app.services.login_code_service import TooManyCodesError, mask_email
from app.utils.mailer import send_mail
from app.utils.rate_limit import check_rate_limit
from app.utils.request import get_client_ip

router = APIRouter(prefix="/auth", tags=["auth"])

TOO_MANY_CODES = "Demasiados códigos enviados seguidos. Espera unos 15 minutos plis 🙏"


class AuthResponse(TokenResponse):
    user: UserMe


# ------------------------------ Registro ----------------------------------


@router.post("/register", response_model=RegisterResponse)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Crea la cuenta y envía un código de 6 dígitos al correo (sin sesión).

    La sesión se crea después, en /auth/login, una vez confirmado el código.
    """
    ip = get_client_ip(request)
    check_rate_limit(f"register:{ip}", limit=5, window_seconds=60)

    try:
        data = start_registration(db, payload)
    except (EmailTakenError, UsernameTakenError):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "El email o usuario ya existe"
        ) from None
    except TooManyCodesError:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_CODES) from None
    return RegisterResponse(**data)


@router.post("/verify-register", response_model=VerifyRegisterResponse)
def verify_register_endpoint(
    payload: VerifyRegisterRequest,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Paso 2 del registro: confirma el código (o pide reenviarlo con resend)."""
    ip = get_client_ip(request)
    check_rate_limit(f"verify-register:{ip}", limit=15, window_seconds=60)

    # Error genérico: no revelar si el email existe (anti-enumeración)
    generic = "Código incorrecto o expirado. Revisa tu correo."
    user = find_verifiable_user(db, payload.email)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, generic)

    if payload.resend:
        try:
            demo_code = send_verification_code(db, user, "confirmar tu cuenta de DevPlay")
        except TooManyCodesError:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_CODES) from None
        return VerifyRegisterResponse(sent_to=mask_email(user.email), demo_code=demo_code)

    if not payload.code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escribe los 6 dígitos del código")

    try:
        verify_register(db, user, payload.code)
    except ValueError as err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(err)) from None

    # Correo de bienvenida 🎉 (no bloquea la respuesta si falla)
    subject, html = welcome_email(user.username)
    background.add_task(send_mail, to=user.email, subject=subject, html=html)
    return VerifyRegisterResponse(ok=True, username=user.username)


# ---------------------- Recuperación de contraseña ------------------------


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password_endpoint(
    payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)
):
    """Paso 1: envía un código de 6 dígitos (10 min, un solo uso) al correo."""
    ip = get_client_ip(request)
    check_rate_limit(f"forgot-password:{ip}", limit=5, window_seconds=60)
    try:
        return ForgotPasswordResponse(**forgot_password(db, payload.email))
    except TooManyCodesError:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_CODES) from None


@router.post("/reset-password", response_model=OkMessageResponse)
def reset_password_endpoint(
    payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)
):
    """Paso 2: valida el código y guarda la contraseña nueva."""
    ip = get_client_ip(request)
    check_rate_limit(f"reset-password:{ip}", limit=10, window_seconds=60)
    try:
        reset_password(db, payload)
    except ValueError as err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(err)) from None
    return OkMessageResponse(
        message="Contraseña actualizada correctamente. Ya puedes iniciar sesión."
    )


# -------------------------------- Invitados --------------------------------


@router.post("/guest", response_model=GuestResponse)
def guest(
    payload: GuestRequest, request: Request, db: Session = Depends(get_db)
):
    """Crea una cuenta de invitado de solo lectura (máx. 3 por IP/min)."""
    ip = get_client_ip(request)
    check_rate_limit(f"guest:{ip}", limit=3, window_seconds=60)
    user = create_guest(db, payload.username)
    tokens = issue_tokens(user)
    return GuestResponse(
        id=user.id,
        username=user.username,
        is_guest=user.is_guest,
        **tokens.model_dump(),
    )


# -------------------------- Login / tokens --------------------------------


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    check_rate_limit(f"login:{ip}", limit=10, window_seconds=60)

    user = authenticate(db, payload.email, payload.password)
    if user is None:
        # Se asocia al usuario si el email existe (el fallo puede ser la clave)
        known = db.scalar(select(User).where(User.email == payload.email.lower()))
        db.add(
            LoginEvent(
                user_id=known.id if known else None,
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

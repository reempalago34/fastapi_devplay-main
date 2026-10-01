"""Token firmado (HMAC-SHA256) para el handshake con el servicio realtime 🔐

Port de devplay-main/src/app/api/devplay/realtime-token/route.ts.

Formato: <expMs>.<base64url(payload)>.<hmac>
payload: { uid, un, exp } — caduca en 30 minutos; el cliente lo renueva en
cada reconexión. El secreto es REALTIME_SECRET (fallback: JWT_SECRET), el
mismo que usa el servicio realtime para verificar.
"""

import base64
import hashlib
import hmac
import json
import time

from app.core.config import get_settings

TOKEN_TTL_MS = 30 * 60 * 1000  # 30 minutos


class RealtimeTokenError(ValueError):
    pass


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(raw: str) -> bytes:
    return base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))


def _secret() -> str:
    settings = get_settings()
    secret = settings.realtime_secret or settings.jwt_secret
    if not secret:
        raise RealtimeTokenError("Falta REALTIME_SECRET/JWT_SECRET")
    return secret


def create_realtime_token(user_id: str, username: str) -> tuple[str, int]:
    """Devuelve (token, expiresInMs)."""
    exp = int(time.time() * 1000) + TOKEN_TTL_MS
    payload = _b64url(
        json.dumps({"uid": user_id, "un": username, "exp": exp}, separators=(",", ":")).encode()
    )
    sig = hmac.new(_secret().encode(), f"{exp}.{payload}".encode(), hashlib.sha256).digest()
    return f"{exp}.{payload}.{_b64url(sig)}", TOKEN_TTL_MS


def verify_realtime_token(token: str) -> dict:
    """Valida firma y expiración; devuelve el payload o lanza RealtimeTokenError."""
    try:
        exp_raw, payload_raw, sig_raw = token.split(".")
        expected = hmac.new(
            _secret().encode(), f"{exp_raw}.{payload_raw}".encode(), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(expected, _b64url_decode(sig_raw)):
            raise RealtimeTokenError("firma inválida")
        payload = json.loads(_b64url_decode(payload_raw))
    except RealtimeTokenError:
        raise
    except Exception as err:  # noqa: BLE001 - cualquier formato raro es un error
        raise RealtimeTokenError("token malformado") from err

    if int(payload.get("exp", 0)) < int(time.time() * 1000):
        raise RealtimeTokenError("token expirado")
    return payload

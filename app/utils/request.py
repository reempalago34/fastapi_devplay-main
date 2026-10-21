from fastapi import Request

from app.core.config import get_settings


def get_client_ip(request: Request) -> str:
    # Solo confiamos en X-Forwarded-For si la API está detrás de un proxy
    # configurado. De lo contrario, cualquiera podría falsificar su IP y
    # saltarse los límites por IP.
    if get_settings().trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"

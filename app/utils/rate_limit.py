"""Rate limiting en memoria (ventana desplazada).

Port simplificado de devplay-main/src/lib/rate-limit.ts.
Ojo: pensado para UNA sola réplica. Con varios contenedores hay que migrar a Redis.
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, status

_hits: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.monotonic()
    window = _hits[key]
    while window and now - window[0] > window_seconds:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests, try again later",
        )
    window.append(now)

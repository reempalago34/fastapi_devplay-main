"""Helpers para convertir columnas JSON-guardadas-como-string (patrón de Prisma).

En devplay-main, campos como `mediaUrls`, `tags`, `socialLinks`, `platforms` y
`screenshots` son String con JSON adentro. Se conserva el mismo formato para que
los datos sean intercambiables entre las dos apps.
"""

import json
from typing import Any


def loads_json(raw: str | None, default: Any) -> Any:
    if raw is None or raw == "":
        return default
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default


def dumps_json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)

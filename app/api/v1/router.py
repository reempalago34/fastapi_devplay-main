from fastapi import APIRouter

from app.api.v1 import auth, follow, health, realtime, security, store, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(security.router)
api_router.include_router(follow.router)
api_router.include_router(store.router)
api_router.include_router(realtime.router)

# --- Punto de integración para el equipo ---
# Cada nueva feature añade UNA línea aquí (un archivo de router por dominio):
#   from app.api.v1 import content
#   api_router.include_router(content.router)

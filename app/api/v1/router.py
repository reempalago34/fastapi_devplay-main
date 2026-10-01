from fastapi import APIRouter

from app.api.v1 import auth, health, polls, posts, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(posts.router)
api_router.include_router(polls.router)

# --- Punto de integración para el equipo ---
# Cada nueva feature añade UNA línea aquí (un archivo de router por dominio):
#   from app.api.v1 import content
#   api_router.include_router(content.router)

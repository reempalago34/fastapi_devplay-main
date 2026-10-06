from fastapi import APIRouter

from app.api.v1 import (
    auth,
    betas,
    buddy,
    chat,
    discover,
    follow,
    health,
    polls,
    posts,
    realtime,
    search,
    security,
    store,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)

# --- Erick: identidad, seguridad, follow, tienda ---
api_router.include_router(security.router)
api_router.include_router(follow.router)
api_router.include_router(store.router)
api_router.include_router(realtime.router)

# --- Frank: contenido, encuestas, betas, directos, chat y notificaciones ---
api_router.include_router(posts.router)
api_router.include_router(polls.router)
api_router.include_router(betas.router)
api_router.include_router(chat.router)

# --- M4 (juntos): buscar, descubrir y el asistente Pixel ---
api_router.include_router(search.router)
api_router.include_router(discover.router)
api_router.include_router(buddy.router)
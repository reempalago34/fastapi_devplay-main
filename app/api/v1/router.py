from fastapi import APIRouter

from app.api.v1 import (
    auth,
    betas,
    follow,
    health,
    polls,
    posts,
    realtime,
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

# --- Frank: contenido, encuestas, betas y directos ---
api_router.include_router(posts.router)
api_router.include_router(polls.router)
api_router.include_router(betas.router)
"""Baton API entrypoint. FROZEN. Auto-discovers app/modules/*/router.py."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core import routes as core_routes
from app.core.config import get_settings
from app.core.db import apply_schema, get_engine
from app.core.demo import seed_demo
from app.core.registry import load_routers


@asynccontextmanager
async def lifespan(_: FastAPI):
    apply_schema()
    with Session(get_engine()) as session:
        seed_demo(session)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="Baton API", version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    application.include_router(core_routes.router)
    for router in load_routers():
        application.include_router(router)
    return application


app = create_app()

"""Baton API entrypoint. FROZEN. Auto-discovers app/modules/*/router.py."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core import routes as core_routes
from app.core.config import get_settings
from app.core.db import apply_schema, get_engine
from app.core.demo import seed_demo
from app.core.registry import load_routers

logger = logging.getLogger("uvicorn.error")


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
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$" if settings.env != "production" else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(core_routes.router)
    for router in load_routers():
        application.include_router(router)

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error processing %s: %s", request.url.path, exc)
        origin = request.headers.get("origin")
        response = JSONResponse(
            status_code=500,
            content={"detail": f"Internal Server Error: {str(exc)}"},
        )
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    return application


app = create_app()

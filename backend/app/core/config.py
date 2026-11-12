"""Settings. FROZEN after Day 0: change only through a contract-change issue."""
import os
from dataclasses import dataclass
from pathlib import Path

DEV_SECRET = "dev-secret-change-me"
# repo/backend/app/core/config.py -> parents[3] is the repo root (same layout inside Docker at /srv)
REPO_ROOT = Path(os.environ.get("BATON_ROOT", Path(__file__).resolve().parents[3]))


def _normalise_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


@dataclass(frozen=True)
class Settings:
    env: str
    database_url: str
    jwt_secret: str
    jwt_ttl_minutes: int
    cors_origins: list[str]
    contracts_dir: Path
    schema_dir: Path


def get_settings() -> Settings:
    env = os.environ.get("ENV", "development")
    secret = os.environ.get("JWT_SECRET", DEV_SECRET)
    if env == "production" and secret == DEV_SECRET:
        raise RuntimeError("JWT_SECRET must be set in production")
    origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    return Settings(
        env=env,
        database_url=_normalise_db_url(os.environ.get("DATABASE_URL", "sqlite:///./baton_dev.db")),
        jwt_secret=secret,
        jwt_ttl_minutes=int(os.environ.get("JWT_TTL_MINUTES", "480")),
        cors_origins=origins,
        contracts_dir=REPO_ROOT / "contracts",
        schema_dir=REPO_ROOT / "db" / "schema",
    )

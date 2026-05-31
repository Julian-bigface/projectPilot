from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.discovery import router as discovery_router
from app.api.project_libraries import router as project_libraries_router
from app.api.projects import router as projects_router
from app.api.settings import router as settings_router
from app.api.translation import router as translation_router
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Project Pilot API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

api_router = APIRouter(prefix="/api")
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(discovery_router, prefix="/discovery", tags=["discovery"])
api_router.include_router(
    project_libraries_router, prefix="/project-libraries", tags=["project-libraries"]
)
api_router.include_router(settings_router, prefix="/settings", tags=["settings"])
api_router.include_router(translation_router, prefix="/translation", tags=["translation"])
app.include_router(api_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _mount_static_if_configured() -> None:
    if not settings.static_dir:
        return
    static_path = Path(settings.static_dir)
    if not static_path.is_dir():
        return
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")


if settings.static_dir:
    _mount_static_if_configured()
else:

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": "Project Pilot API"}

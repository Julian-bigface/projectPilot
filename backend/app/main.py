from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.discovery import router as discovery_router
from app.api.project_libraries import router as project_libraries_router
from app.api.projects import router as projects_router
from app.api.settings import router as settings_router
from app.api.translation import router as translation_router
from app.core.config import settings
from app.core.database import init_db

_NO_STORE_HEADERS = {"Cache-Control": "no-cache, no-store, must-revalidate"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Project Pilot API", version="0.2.0", lifespan=lifespan)

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
    return {"status": "ok", "version": app.version}


def _mount_static_if_configured() -> None:
    if not settings.static_dir:
        return
    static_path = Path(settings.static_dir)
    if not static_path.is_dir():
        return

    index_html = static_path / "index.html"
    assets_dir = static_path / "assets"

    @app.get("/", include_in_schema=False)
    async def spa_index() -> FileResponse:
        return FileResponse(
            index_html,
            media_type="text/html",
            headers=_NO_STORE_HEADERS,
        )

    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Remaining root files (favicon, vite.svg, etc.)
    app.mount(
        "/",
        StaticFiles(directory=str(static_path), html=False),
        name="static-root",
    )


if settings.static_dir:
    _mount_static_if_configured()
else:

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": "Project Pilot API"}

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.folders import router as folders_router
from app.api.library import router as library_router
from app.api.projects import router as projects_router
from app.api.settings import router as settings_router
from app.api.tag_categories import router as tag_categories_router
from app.api.tags import router as tags_router
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

app.include_router(projects_router, prefix="/projects", tags=["projects"])
app.include_router(folders_router, prefix="/folders", tags=["folders"])
app.include_router(library_router, prefix="/library", tags=["library"])
app.include_router(settings_router, prefix="/settings", tags=["settings"])
app.include_router(tags_router, prefix="/tags", tags=["tags"])
app.include_router(tag_categories_router, prefix="/tag-categories", tags=["tag-categories"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Project Pilot API"}

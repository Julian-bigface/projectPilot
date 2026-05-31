from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import folder_bundle as folder_bundle_module
from app.api import folders as folders_router_module
from app.api import library as library_router_module
from app.api import library_projects as library_projects_module
from app.api import tag_categories as tag_categories_module
from app.api import tags as tags_router_module
from app.api.deps import get_project_library
from app.core.database import get_db
from app.models.folder import Folder
from app.models.project import Project
from app.models.project_library import ProjectLibrary
from app.models.tag import Tag, TagCategory
from app.schemas.project_library import (
    ProjectLibraryCreate,
    ProjectLibraryRead,
    ProjectLibraryUpdate,
)
from app.services.project_library_read import (
    project_libraries_to_read,
    project_library_to_read,
)

router = APIRouter()

scoped_router = APIRouter(prefix="/{library_id}")
scoped_router.include_router(
    library_router_module.router, prefix="/library", tags=["library"]
)
scoped_router.include_router(folders_router_module.router, prefix="/folders", tags=["folders"])
scoped_router.include_router(folder_bundle_module.router, tags=["folder-bundle"])
scoped_router.include_router(tags_router_module.router, prefix="/tags", tags=["tags"])
scoped_router.include_router(
    tag_categories_module.router, prefix="/tag-categories", tags=["tag-categories"]
)
scoped_router.include_router(
    library_projects_module.router, prefix="/projects", tags=["projects"]
)
router.include_router(scoped_router)


def _utcnow() -> datetime:
    return datetime.now(UTC)


@router.get("", response_model=list[ProjectLibraryRead])
async def list_project_libraries(db: AsyncSession = Depends(get_db)) -> list[ProjectLibraryRead]:
    rows = (
        (
            await db.execute(
                select(ProjectLibrary).order_by(
                    ProjectLibrary.is_pinned.desc(),
                    ProjectLibrary.sort_order.asc(),
                    ProjectLibrary.name.asc(),
                )
            )
        )
        .scalars()
        .all()
    )
    return await project_libraries_to_read(db, list(rows))


@router.post("", response_model=ProjectLibraryRead, status_code=status.HTTP_201_CREATED)
async def create_project_library(
    body: ProjectLibraryCreate,
    db: AsyncSession = Depends(get_db),
) -> ProjectLibraryRead:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="名称不能为空")
    max_so = await db.scalar(select(func.coalesce(func.max(ProjectLibrary.sort_order), -1)))
    sort_order = int(max_so if max_so is not None else -1) + 1
    desc = body.description.strip() if body.description and body.description.strip() else None
    row = ProjectLibrary(name=name, description=desc, sort_order=sort_order)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return await project_library_to_read(db, row)


@router.get("/{library_id}", response_model=ProjectLibraryRead)
async def get_project_library_detail(
    library: ProjectLibrary = Depends(get_project_library),
    db: AsyncSession = Depends(get_db),
) -> ProjectLibraryRead:
    return await project_library_to_read(db, library)


@router.patch("/{library_id}", response_model=ProjectLibraryRead)
async def patch_project_library(
    body: ProjectLibraryUpdate,
    library: ProjectLibrary = Depends(get_project_library),
    db: AsyncSession = Depends(get_db),
) -> ProjectLibraryRead:
    payload = body.model_dump(exclude_unset=True)
    if "name" in payload and payload["name"] is not None:
        nn = payload["name"].strip()
        if not nn:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="名称不能为空")
        library.name = nn
    if "description" in payload:
        desc = payload["description"]
        library.description = desc.strip() if isinstance(desc, str) and desc.strip() else None
    if "is_pinned" in payload and payload["is_pinned"] is not None:
        library.is_pinned = payload["is_pinned"]
    if "sort_order" in payload and payload["sort_order"] is not None:
        library.sort_order = payload["sort_order"]
    library.updated_at = _utcnow()
    await db.commit()
    await db.refresh(library)
    return await project_library_to_read(db, library)


@router.delete("/{library_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_library(
    library: ProjectLibrary = Depends(get_project_library),
    db: AsyncSession = Depends(get_db),
) -> None:
    lib_id = library.id
    await db.execute(delete(Project).where(Project.project_library_id == lib_id))
    await db.execute(delete(Folder).where(Folder.project_library_id == lib_id))
    await db.execute(delete(Tag).where(Tag.project_library_id == lib_id))
    await db.execute(delete(TagCategory).where(TagCategory.project_library_id == lib_id))
    await db.delete(library)
    await db.commit()

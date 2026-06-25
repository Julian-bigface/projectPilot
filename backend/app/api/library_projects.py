"""资料库内项目列表与创建（按 project_library_id 隔离）。"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_project_library
from app.api.projects import _ensure_folder_exists
from app.core.database import get_db
from app.models.project import Project
from app.models.project_library import ProjectLibrary
from app.models.tag import ProjectTag
from app.schemas.project import PROJECT_STATES, ProjectCreate, ProjectRead
from app.services.github_enrich import try_enrich_project_from_github
from app.services.project_read import project_to_read, projects_to_read
from app.services.project_tags_from_topics import sync_project_tags_from_github_topics

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(UTC)


@router.get("", response_model=list[ProjectRead])
async def list_library_projects(
    response: Response,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
    missing_tags: bool = Query(False, description="仅无任何标签关联的项目"),
    deleted_only: bool = Query(False, description="仅回收站内已软删除的项目"),
    full_name: str | None = Query(None, description="精确匹配 owner/repo"),
    _start: int = Query(0, ge=0, alias="_start"),
    _end: int | None = Query(None, alias="_end"),
) -> list[ProjectRead]:
    count_stmt = select(func.count()).select_from(Project).where(
        Project.project_library_id == library.id
    )
    list_stmt = (
        select(Project)
        .where(Project.project_library_id == library.id)
        .order_by(Project.updated_at.desc())
    )

    if deleted_only:
        count_stmt = count_stmt.where(Project.deleted_at.isnot(None))
        list_stmt = list_stmt.where(Project.deleted_at.isnot(None))
    else:
        count_stmt = count_stmt.where(Project.deleted_at.is_(None))
        list_stmt = list_stmt.where(Project.deleted_at.is_(None))
        if missing_tags:
            no_tag = ~exists().where(ProjectTag.project_id == Project.id)
            count_stmt = count_stmt.where(no_tag)
            list_stmt = list_stmt.where(no_tag)

    if full_name is not None and full_name.strip():
        fn = full_name.strip()
        count_stmt = count_stmt.where(Project.full_name == fn)
        list_stmt = list_stmt.where(Project.full_name == fn)

    total = int(await db.scalar(count_stmt) or 0)
    response.headers["X-Total-Count"] = str(total)

    end = _end if _end is not None else _start + 10
    limit = max(0, min(end - _start, 500))
    rows = (await db.execute(list_stmt.offset(_start).limit(limit))).scalars().all()
    return await projects_to_read(db, list(rows))


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_library_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> ProjectRead:
    await _ensure_folder_exists(db, body.folder_id, library.id)
    if body.state not in PROJECT_STATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"state 须为: {', '.join(PROJECT_STATES)}",
        )
    now = _utcnow()
    project = Project(
        project_library_id=library.id,
        github_url=body.github_url.strip(),
        name=body.name.strip(),
        full_name=body.full_name.strip(),
        folder_id=body.folder_id,
        description=body.description,
        stars=body.stars,
        language=body.language,
        author=body.author,
        license=body.license,
        ai_summary=body.ai_summary,
        deploy_methods=body.deploy_methods,
        state=body.state,
        state_changed_at=now if body.state != "未体验" else None,
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    try:
        await db.commit()
    except IntegrityError as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="数据约束冲突（例如 folder_id 无效）",
        ) from err
    await db.refresh(project)
    enriched = await try_enrich_project_from_github(db, project)
    await db.refresh(project)
    if not enriched and body.topics:
        await sync_project_tags_from_github_topics(
            db, project.id, list(body.topics), library_id=library.id
        )
        await db.commit()
        await db.refresh(project)
    return await project_to_read(db, project)

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.folder import Folder
from app.models.project import Project
from app.models.tag import ProjectTag, Tag
from app.schemas.project import PROJECT_STATES, ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.project_github import GithubRepoPreviewRead, ProjectReadmeRead, ProjectReleasesRead
from app.schemas.project_translate import (
    ProjectTranslateRequest,
    ReadmeBlockTranslateRead,
    ReadmeBlockTranslateRequest,
    ReadmeBlocksRead,
)
from app.services.github_enrich import try_enrich_project_from_github
from app.services.github_repo_preview import preview_github_repository
from app.services.project_github_content import fetch_project_readme, fetch_project_releases
from app.services.project_read import project_to_read, projects_to_read
from app.services.project_tags_from_topics import sync_project_tags_from_github_topics
from app.services.project_translate import (
    list_project_readme_blocks,
    translate_project_description,
    translate_project_readme,
    translate_project_readme_block,
)
from app.services.translation.provider import TranslationError

router = APIRouter()

_TAG_IDS_OMIT = object()


async def _sync_project_tags(db: AsyncSession, project_id: int, tag_ids: list[int]) -> None:
    ordered = list(dict.fromkeys(tag_ids))
    if ordered:
        stmt = select(Tag.id).where(Tag.id.in_(ordered))
        found = set((await db.execute(stmt)).scalars().all())
        if found != set(ordered):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tag_ids 包含不存在的标签",
            )
    await db.execute(delete(ProjectTag).where(ProjectTag.project_id == project_id))
    for tid in ordered:
        db.add(ProjectTag(project_id=project_id, tag_id=tid))


async def _ensure_folder_exists(db: AsyncSession, folder_id: int | None) -> None:
    if folder_id is None:
        return
    folder = await db.get(Folder, folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="folder_id 不存在")


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _apply_updates(project: Project, data: ProjectUpdate) -> None:
    payload = data.model_dump(exclude_unset=True)
    state_before = project.state
    for key, value in payload.items():
        setattr(project, key, value)
    if "state" in payload and payload["state"] != state_before:
        project.state_changed_at = _utcnow()
    project.updated_at = _utcnow()


def _not_found_deleted() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    response: Response,
    db: AsyncSession = Depends(get_db),
    state: str | None = Query(None, description="筛选状态（未体验/正在体验/推荐归档/放弃归档）"),
    missing_tags: bool = Query(False, description="仅无任何标签关联的项目"),
    deleted_only: bool = Query(False, description="仅回收站内已软删除的项目"),
    _start: int = Query(0, ge=0, alias="_start"),
    _end: int | None = Query(None, alias="_end"),
) -> list[ProjectRead]:
    count_stmt = select(func.count()).select_from(Project)
    list_stmt = select(Project).order_by(Project.updated_at.desc())

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

    if state is not None:
        if state not in PROJECT_STATES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"state 须为: {', '.join(PROJECT_STATES)}",
            )
        count_stmt = count_stmt.where(Project.state == state)
        list_stmt = list_stmt.where(Project.state == state)

    total = int(await db.scalar(count_stmt) or 0)
    response.headers["X-Total-Count"] = str(total)

    end = _end if _end is not None else _start + 10
    limit = max(0, min(end - _start, 500))
    rows = (await db.execute(list_stmt.offset(_start).limit(limit))).scalars().all()
    return await projects_to_read(db, list(rows))


@router.get("/preview-github", response_model=GithubRepoPreviewRead)
async def preview_github_repo(
    github_url: str = Query(..., min_length=1, max_length=2048, description="GitHub 仓库 URL"),
    db: AsyncSession = Depends(get_db),
) -> GithubRepoPreviewRead:
    return await preview_github_repository(db, github_url.strip())


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)) -> ProjectRead:
    await _ensure_folder_exists(db, body.folder_id)
    now = _utcnow()
    project = Project(
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
        await sync_project_tags_from_github_topics(db, project.id, list(body.topics))
        await db.commit()
        await db.refresh(project)
    return await project_to_read(db, project)


@router.post("/{project_id}/refresh-github", response_model=ProjectRead)
async def refresh_project_github(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    scope: str | None = Query(
        None,
        description="stats：仅更新 Stars/Forks/推送/许可证等统计行，不改动简介与标签",
    ),
) -> ProjectRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    stats_only = scope == "stats"
    ok = await try_enrich_project_from_github(db, project, stats_only=stats_only)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=(
                "无法从 GitHub 更新：请配置 Token，或确认仓库为 github.com 且 "
                "full_name / 链接可解析为 owner/repo。"
            ),
        )
    return await project_to_read(db, project)


@router.post("/{project_id}/restore", response_model=ProjectRead)
async def restore_project(project_id: int, db: AsyncSession = Depends(get_db)) -> ProjectRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is None:
        raise _not_found_deleted()
    project.deleted_at = None
    project.updated_at = _utcnow()
    await db.commit()
    await db.refresh(project)
    return await project_to_read(db, project)


@router.delete("/{project_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_permanent(project_id: int, db: AsyncSession = Depends(get_db)) -> None:
    project = await db.get(Project, project_id)
    if project is None:
        raise _not_found_deleted()
    if project.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅可彻底删除回收站中的项目；请先在资料库将项目移入回收站。",
        )
    await db.delete(project)
    await db.commit()


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)) -> ProjectRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    return await project_to_read(db, project)


@router.get("/{project_id}/readme", response_model=ProjectReadmeRead)
async def get_project_readme(
    project_id: int, db: AsyncSession = Depends(get_db)
) -> ProjectReadmeRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    return await fetch_project_readme(db, project)


@router.get("/{project_id}/releases", response_model=ProjectReleasesRead)
async def get_project_releases(
    project_id: int, db: AsyncSession = Depends(get_db)
) -> ProjectReleasesRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    return await fetch_project_releases(db, project)


@router.get("/{project_id}/readme/blocks", response_model=ReadmeBlocksRead)
async def get_project_readme_blocks(
    project_id: int, db: AsyncSession = Depends(get_db)
) -> ReadmeBlocksRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    try:
        blocks = await list_project_readme_blocks(db, project)
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail="无法获取 README 分段，请稍后重试。",
        ) from err
    return ReadmeBlocksRead(blocks=blocks)


@router.post("/{project_id}/translate/readme-block", response_model=ReadmeBlockTranslateRead)
async def translate_project_readme_block_endpoint(
    project_id: int,
    body: ReadmeBlockTranslateRequest,
    db: AsyncSession = Depends(get_db),
) -> ReadmeBlockTranslateRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    try:
        translated = await translate_project_readme_block(db, body.content)
    except TranslationError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail="段落翻译失败，请稍后重试。",
        ) from err
    return ReadmeBlockTranslateRead(translated=translated)


@router.post("/{project_id}/translate", response_model=ProjectRead)
async def translate_project(
    project_id: int,
    body: ProjectTranslateRequest,
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    try:
        if "description" in body.fields:
            await translate_project_description(db, project)
        if "readme" in body.fields:
            await translate_project_readme(db, project)
    except TranslationError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail="翻译失败，请稍后重试。",
        ) from err
    await db.commit()
    await db.refresh(project)
    return await project_to_read(db, project)


@router.patch("/{project_id}", response_model=ProjectRead)
async def patch_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    payload = body.model_dump(exclude_unset=True)
    tag_ids_update = payload.pop("tag_ids", _TAG_IDS_OMIT)

    if "folder_id" in payload:
        await _ensure_folder_exists(db, payload["folder_id"])

    if tag_ids_update is not _TAG_IDS_OMIT:
        if not isinstance(tag_ids_update, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tag_ids 须为整数数组",
            )
        await _sync_project_tags(db, project_id, [int(x) for x in tag_ids_update])

    if payload:
        partial = ProjectUpdate(**payload)
        _apply_updates(project, partial)

    try:
        await db.commit()
    except IntegrityError as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="数据约束冲突（例如 folder_id 无效）",
        ) from err
    await db.refresh(project)
    return await project_to_read(db, project)


@router.delete("/{project_id}", response_model=ProjectRead)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)) -> ProjectRead:
    project = await db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise _not_found_deleted()
    project.deleted_at = _utcnow()
    project.updated_at = _utcnow()
    await db.commit()
    await db.refresh(project)
    return await project_to_read(db, project)

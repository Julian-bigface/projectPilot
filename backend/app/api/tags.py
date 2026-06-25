from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_project_library
from app.core.database import get_db
from app.models.project_library import ProjectLibrary
from app.models.project import Project
from app.models.tag import FolderTag, ProjectTag, Tag, TagCategory
from app.schemas.tag import TagCreate, TagRead, TagUpdate
from app.schemas.tag_ai import (
    TagCategoryApplyRequest,
    TagCategoryApplyResponse,
    TagCategorySuggestRequest,
    TagCategorySuggestResponse,
)
from app.services.llm.provider import LlmError
from app.services.tag_category_suggest import (
    _prepare_suggest_context,
    apply_tag_category_suggestions,
    iter_suggest_tag_categories,
    iter_suggest_tag_categories_from_context,
    suggest_tag_categories,
)
from app.services.tag_normalize import normalize_tag_name

router = APIRouter()


async def _tag_usage_counts(db: AsyncSession, tag_id: int) -> tuple[int, int]:
    pc = int(
        await db.scalar(
            select(func.count())
            .select_from(ProjectTag)
            .join(Project, ProjectTag.project_id == Project.id)
            .where(ProjectTag.tag_id == tag_id, Project.deleted_at.is_(None))
        )
        or 0
    )
    fc = int(
        await db.scalar(
            select(func.count()).select_from(FolderTag).where(FolderTag.tag_id == tag_id)
        )
        or 0
    )
    return pc, fc


def _tag_read_from_row(
    tag: Tag,
    category_name: str | None,
    project_usage: int,
    folder_usage: int,
) -> TagRead:
    return TagRead(
        id=tag.id,
        name=tag.name,
        category_id=tag.category_id,
        category_name=category_name,
        project_usage_count=project_usage,
        folder_usage_count=folder_usage,
        usage_count=project_usage + folder_usage,
    )


@router.get("", response_model=list[TagRead])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
    q: str | None = Query(None, description="按名称包含过滤"),
    category_id: int | None = Query(None, description="筛选所属分类 id"),
    uncategorized: bool = Query(False, description="仅未分类（忽略 category_id）"),
) -> list[TagRead]:
    project_usage_sq = (
        select(ProjectTag.tag_id.label("tid"), func.count(ProjectTag.project_id).label("uc"))
        .join(Project, ProjectTag.project_id == Project.id)
        .where(Project.deleted_at.is_(None))
        .group_by(ProjectTag.tag_id)
        .subquery()
    )
    folder_usage_sq = (
        select(FolderTag.tag_id.label("tid"), func.count(FolderTag.folder_id).label("uc"))
        .group_by(FolderTag.tag_id)
        .subquery()
    )

    stmt = (
        select(
            Tag,
            TagCategory.name,
            func.coalesce(project_usage_sq.c.uc, 0),
            func.coalesce(folder_usage_sq.c.uc, 0),
        )
        .outerjoin(TagCategory, Tag.category_id == TagCategory.id)
        .outerjoin(project_usage_sq, Tag.id == project_usage_sq.c.tid)
        .outerjoin(folder_usage_sq, Tag.id == folder_usage_sq.c.tid)
        .where(Tag.project_library_id == library.id)
        .order_by(Tag.name.asc())
    )
    if q:
        stmt = stmt.where(Tag.name.contains(q.strip()))
    if uncategorized:
        stmt = stmt.where(Tag.category_id.is_(None))
    elif category_id is not None:
        stmt = stmt.where(Tag.category_id == category_id)

    rows = (await db.execute(stmt)).all()
    return [
        _tag_read_from_row(tag, cn, int(pu or 0), int(fu or 0))
        for tag, cn, pu, fu in rows
    ]


@router.post("", response_model=TagRead, status_code=status.HTTP_201_CREATED)
async def create_tag(
    body: TagCreate,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> TagRead:
    name = normalize_tag_name(body.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="标签名不能为空")

    if body.category_id is not None:
        cat = await db.get(TagCategory, body.category_id)
        if cat is None or cat.project_library_id != library.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="category_id 不存在")

    tag = Tag(name=name, category_id=body.category_id, project_library_id=library.id)
    db.add(tag)
    try:
        await db.commit()
    except IntegrityError as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="标签名已存在",
        ) from err
    await db.refresh(tag)
    cn = None
    if tag.category_id is not None:
        c = await db.get(TagCategory, tag.category_id)
        cn = c.name if c else None
    return _tag_read_from_row(tag, cn, 0, 0)


@router.post("/suggest-categories", response_model=TagCategorySuggestResponse)
async def post_suggest_tag_categories(
    body: TagCategorySuggestRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> TagCategorySuggestResponse:
    try:
        return await suggest_tag_categories(
            db,
            library_id=library.id,
            tag_ids=body.tag_ids,
            include_new_categories=body.include_new_categories,
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    except LlmError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err


@router.post("/suggest-categories/stream")
async def post_suggest_tag_categories_stream(
    body: TagCategorySuggestRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> StreamingResponse:
    """NDJSON 流式返回：每完成一批 LLM 请求即推送 proposals。"""
    try:
        ctx = await _prepare_suggest_context(
            db,
            library_id=library.id,
            tag_ids=body.tag_ids,
            include_new_categories=body.include_new_categories,
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    except LlmError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err

    async def generate():
        try:
            async for event in iter_suggest_tag_categories_from_context(ctx):
                yield (event.model_dump_json() + "\n").encode("utf-8")
        except Exception as err:
            payload = json.dumps({"event": "error", "detail": str(err)}, ensure_ascii=False)
            yield (payload + "\n").encode("utf-8")

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/apply-category-suggestions", response_model=TagCategoryApplyResponse)
async def post_apply_tag_category_suggestions(
    body: TagCategoryApplyRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> TagCategoryApplyResponse:
    return await apply_tag_category_suggestions(
        db,
        library_id=library.id,
        items=body.items,
    )


@router.patch("/{tag_id}", response_model=TagRead)
async def patch_tag(
    tag_id: int,
    body: TagUpdate,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> TagRead:
    tag = await db.get(Tag, tag_id)
    if tag is None or tag.project_library_id != library.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="标签不存在")

    payload = body.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无更新字段")

    if "name" in payload:
        name = normalize_tag_name(payload["name"])
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="标签名不能为空")
        tag.name = name

    if "category_id" in payload:
        cid = payload["category_id"]
        if cid is not None:
            cat = await db.get(TagCategory, cid)
            if cat is None or cat.project_library_id != library.id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="category_id 不存在")
        tag.category_id = cid

    try:
        await db.commit()
    except IntegrityError as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="标签名已存在",
        ) from err
    await db.refresh(tag)

    pu, fu = await _tag_usage_counts(db, tag_id)

    cn = None
    if tag.category_id is not None:
        c = await db.get(TagCategory, tag.category_id)
        cn = c.name if c else None

    return _tag_read_from_row(tag, cn, pu, fu)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> None:
    tag = await db.get(Tag, tag_id)
    if tag is None or tag.project_library_id != library.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="标签不存在")

    await db.execute(delete(ProjectTag).where(ProjectTag.tag_id == tag_id))
    await db.execute(delete(FolderTag).where(FolderTag.tag_id == tag_id))
    await db.delete(tag)
    await db.commit()

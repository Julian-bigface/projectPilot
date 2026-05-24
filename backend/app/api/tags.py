from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.tag import FolderTag, ProjectTag, Tag, TagCategory
from app.schemas.tag import TagCreate, TagRead, TagUpdate
from app.services.tag_normalize import normalize_tag_name

router = APIRouter()


async def _tag_usage_count(db: AsyncSession, tag_id: int) -> int:
    pc = int(
        await db.scalar(
            select(func.count()).select_from(ProjectTag).where(ProjectTag.tag_id == tag_id)
        )
        or 0
    )
    fc = int(
        await db.scalar(
            select(func.count()).select_from(FolderTag).where(FolderTag.tag_id == tag_id)
        )
        or 0
    )
    return pc + fc


@router.get("", response_model=list[TagRead])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(None, description="按名称包含过滤"),
    category_id: int | None = Query(None, description="筛选所属分类 id"),
    uncategorized: bool = Query(False, description="仅未分类（忽略 category_id）"),
) -> list[TagRead]:
    project_usage_sq = (
        select(ProjectTag.tag_id.label("tid"), func.count(ProjectTag.project_id).label("uc"))
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
            func.coalesce(project_usage_sq.c.uc, 0) + func.coalesce(folder_usage_sq.c.uc, 0),
        )
        .outerjoin(TagCategory, Tag.category_id == TagCategory.id)
        .outerjoin(project_usage_sq, Tag.id == project_usage_sq.c.tid)
        .outerjoin(folder_usage_sq, Tag.id == folder_usage_sq.c.tid)
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
        TagRead(
            id=tag.id,
            name=tag.name,
            category_id=tag.category_id,
            category_name=cn,
            usage_count=int(uc or 0),
        )
        for tag, cn, uc in rows
    ]


@router.post("", response_model=TagRead, status_code=status.HTTP_201_CREATED)
async def create_tag(body: TagCreate, db: AsyncSession = Depends(get_db)) -> TagRead:
    name = normalize_tag_name(body.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="标签名不能为空")

    if body.category_id is not None:
        cat = await db.get(TagCategory, body.category_id)
        if cat is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="category_id 不存在")

    tag = Tag(name=name, category_id=body.category_id)
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
    return TagRead(
        id=tag.id,
        name=tag.name,
        category_id=tag.category_id,
        category_name=cn,
        usage_count=0,
    )


@router.patch("/{tag_id}", response_model=TagRead)
async def patch_tag(tag_id: int, body: TagUpdate, db: AsyncSession = Depends(get_db)) -> TagRead:
    tag = await db.get(Tag, tag_id)
    if tag is None:
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
            if cat is None:
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

    uc = await _tag_usage_count(db, tag_id)

    cn = None
    if tag.category_id is not None:
        c = await db.get(TagCategory, tag.category_id)
        cn = c.name if c else None

    return TagRead(
        id=tag.id,
        name=tag.name,
        category_id=tag.category_id,
        category_name=cn,
        usage_count=uc,
    )


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: int, db: AsyncSession = Depends(get_db)) -> None:
    tag = await db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="标签不存在")

    n = await _tag_usage_count(db, tag_id)
    if n > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"仍有 {n} 处（项目或文件夹）使用该标签，请先解除关联",
        )

    await db.delete(tag)
    await db.commit()

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_project_library
from app.core.database import get_db
from app.models.project_library import ProjectLibrary
from app.models.tag import Tag, TagCategory
from app.schemas.tag_category import TagCategoryCreate, TagCategoryRead, TagCategoryUpdate

router = APIRouter()


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().split())


@router.get("", response_model=list[TagCategoryRead])
async def list_tag_categories(
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> list[TagCategoryRead]:
    stmt = (
        select(TagCategory)
        .where(TagCategory.project_library_id == library.id)
        .order_by(TagCategory.sort_order.asc(), TagCategory.name.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [TagCategoryRead.model_validate(r) for r in rows]


@router.post("", response_model=TagCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_tag_category(
    body: TagCategoryCreate,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> TagCategoryRead:
    name = _normalize_name(body.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分类名不能为空")

    max_so = await db.scalar(
        select(func.coalesce(func.max(TagCategory.sort_order), -1)).where(
            TagCategory.project_library_id == library.id
        )
    )
    next_order = int(max_so if max_so is not None else -1) + 1
    sort_order = body.sort_order if body.sort_order is not None else next_order

    cat = TagCategory(name=name, sort_order=sort_order, project_library_id=library.id)
    db.add(cat)
    try:
        await db.commit()
    except IntegrityError as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="分类名已存在",
        ) from err
    await db.refresh(cat)
    return TagCategoryRead.model_validate(cat)


@router.patch("/{category_id}", response_model=TagCategoryRead)
async def update_tag_category(
    category_id: int,
    body: TagCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> TagCategoryRead:
    cat = await db.get(TagCategory, category_id)
    if cat is None or cat.project_library_id != library.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")

    payload = body.model_dump(exclude_unset=True)
    if "name" in payload and payload["name"] is not None:
        nn = _normalize_name(payload["name"])
        if not nn:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="分类名不能为空")
        cat.name = nn
    if "sort_order" in payload and payload["sort_order"] is not None:
        cat.sort_order = payload["sort_order"]

    try:
        await db.commit()
    except IntegrityError as err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="分类名已存在",
        ) from err
    await db.refresh(cat)
    return TagCategoryRead.model_validate(cat)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> None:
    cat = await db.get(TagCategory, category_id)
    if cat is None or cat.project_library_id != library.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")

    # 显式置空，避免 SQLite 未启用外键时标签 orphaned
    await db.execute(
        update(Tag)
        .where(Tag.category_id == category_id, Tag.project_library_id == library.id)
        .values(category_id=None)
    )
    await db.delete(cat)
    await db.commit()

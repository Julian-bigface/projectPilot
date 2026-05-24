from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.folder import Folder
from app.models.project import Project
from app.models.tag import FolderTag, Tag
from app.schemas.folder import FolderCreate, FolderRead, FolderReorder, FolderUpdate
from app.services.folder_read import folder_to_read, folders_to_read

router = APIRouter()

_TAG_IDS_OMIT = object()


async def _get_folder(db: AsyncSession, folder_id: int) -> Folder | None:
    return await db.get(Folder, folder_id)


async def _sync_folder_tags(db: AsyncSession, folder_id: int, tag_ids: list[int]) -> None:
    ordered = list(dict.fromkeys(tag_ids))
    if ordered:
        stmt = select(Tag.id).where(Tag.id.in_(ordered))
        found = set((await db.execute(stmt)).scalars().all())
        if found != set(ordered):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tag_ids 包含不存在的标签",
            )
    await db.execute(delete(FolderTag).where(FolderTag.folder_id == folder_id))
    for tid in ordered:
        db.add(FolderTag(folder_id=folder_id, tag_id=tid))


async def _folder_is_ancestor_of(db: AsyncSession, ancestor_id: int, node_id: int | None) -> bool:
    """从 node_id 沿 parent 链向上，是否经过 ancestor_id。"""
    cur_id = node_id
    seen = set()
    while cur_id is not None:
        if cur_id in seen:
            break
        seen.add(cur_id)
        if cur_id == ancestor_id:
            return True
        row = await db.get(Folder, cur_id)
        if row is None:
            break
        cur_id = row.parent_id
    return False


async def _next_sort_order(db: AsyncSession, parent_id: int | None) -> int:
    m = await db.scalar(select(func.max(Folder.sort_order)).where(Folder.parent_id == parent_id))
    return (m if m is not None else -1) + 1


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def _collect_subtree_folder_ids_postorder(db: AsyncSession, root_id: int) -> list[int]:
    """子树内所有文件夹 id，后序（子先于父），含 root_id。"""
    child_ids = (
        (await db.execute(select(Folder.id).where(Folder.parent_id == root_id).order_by(Folder.id.asc())))
        .scalars()
        .all()
    )
    out: list[int] = []
    for cid in child_ids:
        out.extend(await _collect_subtree_folder_ids_postorder(db, cid))
    out.append(root_id)
    return out


async def _normalize_siblings(
    db: AsyncSession,
    parent_id: int | None,
    *,
    exclude_folder_id: int | None = None,
) -> None:
    q = select(Folder).where(Folder.parent_id == parent_id)
    if exclude_folder_id is not None:
        q = q.where(Folder.id != exclude_folder_id)
    rows = (
        (await db.execute(q.order_by(Folder.sort_order.asc(), Folder.name.asc())))
        .scalars()
        .all()
    )
    for i, row in enumerate(rows):
        row.sort_order = i


@router.post("/reorder", response_model=list[FolderRead])
async def reorder_folders(
    body: FolderReorder,
    db: AsyncSession = Depends(get_db),
) -> list[FolderRead]:
    expected = (
        (await db.execute(select(Folder).where(Folder.parent_id == body.parent_id)))
        .scalars()
        .all()
    )
    expected_ids = {f.id for f in expected}
    got = set(body.ordered_ids)
    if expected_ids != got or len(body.ordered_ids) != len(expected_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ordered_ids 必须与当前父级下的子文件夹完全一致（各出现一次）",
        )

    id_to_folder = {f.id: f for f in expected}
    for i, fid in enumerate(body.ordered_ids):
        id_to_folder[fid].sort_order = i

    await db.commit()
    ordered = [id_to_folder[fid] for fid in body.ordered_ids]
    return await folders_to_read(db, ordered)


@router.get("", response_model=list[FolderRead])
async def list_folders_flat(db: AsyncSession = Depends(get_db)) -> list[FolderRead]:
    rows = (
        (
            await db.execute(
                select(Folder).order_by(
                    Folder.parent_id.asc(),
                    Folder.sort_order.asc(),
                    Folder.name.asc(),
                )
            )
        )
        .scalars()
        .all()
    )
    return await folders_to_read(db, list(rows))


@router.post("", response_model=FolderRead, status_code=status.HTTP_201_CREATED)
async def create_folder(body: FolderCreate, db: AsyncSession = Depends(get_db)) -> FolderRead:
    if body.parent_id is not None:
        parent = await _get_folder(db, body.parent_id)
        if parent is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="parent_id 不存在")

    sort_order = await _next_sort_order(db, body.parent_id)
    folder = Folder(parent_id=body.parent_id, name=body.name.strip(), sort_order=sort_order)
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return await folder_to_read(db, folder)


@router.patch("/{folder_id}", response_model=FolderRead)
async def patch_folder(
    folder_id: int,
    body: FolderUpdate,
    db: AsyncSession = Depends(get_db),
) -> FolderRead:
    folder = await _get_folder(db, folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")

    payload = body.model_dump(exclude_unset=True)
    tag_ids_update = payload.pop("tag_ids", _TAG_IDS_OMIT)

    if tag_ids_update is not _TAG_IDS_OMIT:
        if not isinstance(tag_ids_update, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tag_ids 须为整数数组",
            )
        await _sync_folder_tags(db, folder_id, [int(x) for x in tag_ids_update])

    if "parent_id" in payload:
        new_parent = payload["parent_id"]
        if new_parent == folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能将文件夹设为自己的子级",
            )
        if new_parent is not None:
            p = await _get_folder(db, new_parent)
            if p is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="parent_id 不存在",
                )
            if await _folder_is_ancestor_of(db, folder_id, new_parent):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="不能将文件夹移动到其子文件夹下",
                )
        if new_parent != folder.parent_id:
            await _normalize_siblings(db, folder.parent_id, exclude_folder_id=folder.id)
            folder.parent_id = new_parent
            folder.sort_order = await _next_sort_order(db, new_parent)

    if "name" in payload:
        folder.name = payload["name"].strip()

    if "description" in payload:
        desc = payload["description"]
        folder.description = desc.strip() if isinstance(desc, str) and desc.strip() else None

    await db.commit()
    await db.refresh(folder)
    return await folder_to_read(db, folder)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(folder_id: int, db: AsyncSession = Depends(get_db)) -> None:
    folder = await _get_folder(db, folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")

    parent_id = folder.parent_id
    subtree_postorder = await _collect_subtree_folder_ids_postorder(db, folder_id)
    now = _utcnow()

    await db.execute(
        update(Project)
        .where(Project.folder_id.in_(subtree_postorder), Project.deleted_at.is_(None))
        .values(deleted_at=now, updated_at=now)
    )

    for fid in subtree_postorder:
        row = await db.get(Folder, fid)
        if row is not None:
            await db.delete(row)

    await db.flush()
    await _normalize_siblings(db, parent_id)
    await db.commit()

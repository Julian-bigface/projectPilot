"""Build FolderRead with tags."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder
from app.models.tag import FolderTag, Tag
from app.schemas.folder import FolderRead
from app.schemas.project import TagBrief


async def load_tags_map_for_folders(
    db: AsyncSession, folder_ids: list[int]
) -> dict[int, list[TagBrief]]:
    if not folder_ids:
        return {}
    stmt = (
        select(FolderTag.folder_id, Tag.id, Tag.name, Tag.category_id)
        .join(Tag, FolderTag.tag_id == Tag.id)
        .where(FolderTag.folder_id.in_(folder_ids))
        .order_by(Tag.name.asc())
    )
    rows = (await db.execute(stmt)).all()
    m: dict[int, list[TagBrief]] = defaultdict(list)
    for fid, tid, name, cid in rows:
        m[fid].append(TagBrief(id=tid, name=name, category_id=cid))
    return dict(m)


async def folder_to_read(db: AsyncSession, folder: Folder) -> FolderRead:
    tmap = await load_tags_map_for_folders(db, [folder.id])
    tags = tmap.get(folder.id, [])
    return FolderRead.model_validate(folder).model_copy(update={"tags": tags})


async def folders_to_read(db: AsyncSession, folders: list[Folder]) -> list[FolderRead]:
    if not folders:
        return []
    fids = [f.id for f in folders]
    tmap = await load_tags_map_for_folders(db, fids)
    out: list[FolderRead] = []
    for f in folders:
        tags = tmap.get(f.id, [])
        out.append(FolderRead.model_validate(f).model_copy(update={"tags": tags}))
    return out

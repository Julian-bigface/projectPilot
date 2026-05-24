"""Build ProjectRead with computed folder_name and tags."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder
from app.models.project import Project
from app.models.tag import ProjectTag, Tag
from app.schemas.project import ProjectRead, TagBrief


async def load_tags_map_for_projects(
    db: AsyncSession, project_ids: list[int]
) -> dict[int, list[TagBrief]]:
    if not project_ids:
        return {}
    stmt = (
        select(ProjectTag.project_id, Tag.id, Tag.name, Tag.category_id)
        .join(Tag, ProjectTag.tag_id == Tag.id)
        .where(ProjectTag.project_id.in_(project_ids))
        .order_by(Tag.name.asc())
    )
    rows = (await db.execute(stmt)).all()
    m: dict[int, list[TagBrief]] = defaultdict(list)
    for pid, tid, name, cid in rows:
        m[pid].append(TagBrief(id=tid, name=name, category_id=cid))
    return dict(m)


def project_read_with_folder_name(
    project: Project,
    folder_name: str | None,
    tags: list[TagBrief] | None = None,
) -> ProjectRead:
    """Attach folder display name + tags when building library tree."""
    tag_list = tags if tags is not None else []
    return ProjectRead.model_validate(project).model_copy(
        update={"folder_name": folder_name, "tags": tag_list}
    )


async def project_to_read(db: AsyncSession, project: Project) -> ProjectRead:
    """Resolve folder name and tags from DB for arbitrary project rows."""
    folder_name: str | None = None
    if project.folder_id is not None:
        folder = await db.get(Folder, project.folder_id)
        folder_name = folder.name if folder is not None else None
    tmap = await load_tags_map_for_projects(db, [project.id])
    tags = tmap.get(project.id, [])
    return ProjectRead.model_validate(project).model_copy(
        update={"folder_name": folder_name, "tags": tags}
    )


async def projects_to_read(db: AsyncSession, projects: list[Project]) -> list[ProjectRead]:
    """Batch-resolve folder names and tags for list endpoints."""
    if not projects:
        return []
    pids = [p.id for p in projects]
    tmap = await load_tags_map_for_projects(db, pids)

    ids = {p.folder_id for p in projects if p.folder_id is not None}
    id_to_name: dict[int, str] = {}
    if ids:
        rows = (await db.execute(select(Folder).where(Folder.id.in_(ids)))).scalars().all()
        id_to_name = {f.id: f.name for f in rows}

    out: list[ProjectRead] = []
    for p in projects:
        fn = id_to_name.get(p.folder_id) if p.folder_id is not None else None
        tags = tmap.get(p.id, [])
        out.append(
            ProjectRead.model_validate(p).model_copy(update={"folder_name": fn, "tags": tags})
        )
    return out

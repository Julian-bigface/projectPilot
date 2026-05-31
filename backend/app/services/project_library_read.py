from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.project_library import ProjectLibrary
from app.schemas.project_library import ProjectLibraryRead


async def project_libraries_to_read(db: AsyncSession, rows: list[ProjectLibrary]) -> list[ProjectLibraryRead]:
    if not rows:
        return []
    ids = [r.id for r in rows]
    counts_stmt = (
        select(Project.project_library_id, func.count(Project.id))
        .where(Project.project_library_id.in_(ids), Project.deleted_at.is_(None))
        .group_by(Project.project_library_id)
    )
    count_map = {int(lid): int(c) for lid, c in (await db.execute(counts_stmt)).all()}
    return [
        ProjectLibraryRead(
            id=r.id,
            name=r.name,
            description=r.description,
            is_pinned=r.is_pinned,
            sort_order=r.sort_order,
            project_count=count_map.get(r.id, 0),
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


async def project_library_to_read(db: AsyncSession, row: ProjectLibrary) -> ProjectLibraryRead:
    return (await project_libraries_to_read(db, [row]))[0]

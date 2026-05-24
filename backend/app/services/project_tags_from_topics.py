"""将 GitHub topics 同步为领域标签（Tag + ProjectTag）。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import ProjectTag, Tag
from app.services.tag_normalize import normalize_tag_name


async def sync_project_tags_from_github_topics(
    db: AsyncSession,
    project_id: int,
    topic_names: list[str] | None,
) -> None:
    """按 topic 名称 get-or-create Tag（新建仅未分类；已存在不改分类），并关联到项目。"""
    if not topic_names:
        return

    ordered_unique: list[str] = []
    for raw in topic_names:
        name = normalize_tag_name(raw)
        if not name or name in ordered_unique:
            continue
        ordered_unique.append(name)

    for name in ordered_unique:
        stmt = select(Tag).where(Tag.name == name)
        tag = (await db.execute(stmt)).scalar_one_or_none()
        if tag is None:
            tag = Tag(name=name, category_id=None)
            db.add(tag)
            await db.flush()

        link_stmt = select(ProjectTag).where(
            ProjectTag.project_id == project_id,
            ProjectTag.tag_id == tag.id,
        )
        existing = (await db.execute(link_stmt)).scalar_one_or_none()
        if existing is None:
            db.add(ProjectTag(project_id=project_id, tag_id=tag.id))

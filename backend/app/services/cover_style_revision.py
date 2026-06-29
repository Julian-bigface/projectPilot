"""内容工厂 — 封面风格 AI 调整版本历史。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content_factory_cover_style_revision import ContentFactoryCoverStyleRevision
from app.services.cover_style_design_analysis import CoverStyleDesignAnalysis
from app.services.cover_style_presets import ColorTokens, FontTokens
from app.services.cover_style_registry import resolve_style
from app.services.readme_cover_storage import (
    clone_style_example_for_revision,
    cover_absolute_path,
)

_MAX_REVISIONS_PER_STYLE = 20
_INSTRUCTION_MAX_LEN = 500


class CoverStyleRevisionError(Exception):
    """版本历史操作失败。"""


@dataclass(frozen=True)
class CoverStyleRevisionSnapshot:
    design_analysis: CoverStyleDesignAnalysis | None
    prompt_prefix: str
    prompt_template: str
    negative_prompt: str
    color_tokens: ColorTokens
    font_tokens: FontTokens
    style_report: str | None

    def to_json(self) -> dict:
        return {
            "design_analysis": (
                self.design_analysis.model_dump() if self.design_analysis else None
            ),
            "prompt_prefix": self.prompt_prefix,
            "prompt_template": self.prompt_template,
            "negative_prompt": self.negative_prompt,
            "color_tokens": self.color_tokens.model_dump(),
            "font_tokens": self.font_tokens.model_dump(),
            "style_report": self.style_report,
        }

    @classmethod
    def from_json(cls, data: dict) -> CoverStyleRevisionSnapshot:
        da_raw = data.get("design_analysis")
        design_analysis = None
        if isinstance(da_raw, dict):
            try:
                design_analysis = CoverStyleDesignAnalysis.model_validate(da_raw)
            except Exception:
                design_analysis = None
        ct_raw = data.get("color_tokens") or {}
        ft_raw = data.get("font_tokens") or {}
        try:
            color_tokens = ColorTokens.model_validate(ct_raw)
        except Exception:
            color_tokens = ColorTokens()
        try:
            font_tokens = FontTokens.model_validate(ft_raw)
        except Exception:
            font_tokens = FontTokens()
        return cls(
            design_analysis=design_analysis,
            prompt_prefix=str(data.get("prompt_prefix") or ""),
            prompt_template=str(data.get("prompt_template") or ""),
            negative_prompt=str(data.get("negative_prompt") or ""),
            color_tokens=color_tokens,
            font_tokens=font_tokens,
            style_report=(
                str(data["style_report"]) if data.get("style_report") else None
            ),
        )


async def _next_revision_index(db: AsyncSession, *, style_id: str) -> int:
    stmt = select(func.max(ContentFactoryCoverStyleRevision.revision_index)).where(
        ContentFactoryCoverStyleRevision.style_id == style_id
    )
    current = (await db.execute(stmt)).scalar_one_or_none()
    return (current or 0) + 1


async def _prune_old_revisions(db: AsyncSession, *, style_id: str) -> None:
    stmt = (
        select(ContentFactoryCoverStyleRevision)
        .where(ContentFactoryCoverStyleRevision.style_id == style_id)
        .order_by(ContentFactoryCoverStyleRevision.revision_index.desc())
    )
    rows = list((await db.execute(stmt)).scalars().all())
    if len(rows) <= _MAX_REVISIONS_PER_STYLE:
        return
    for row in rows[_MAX_REVISIONS_PER_STYLE:]:
        if row.example_image_path:
            absolute = cover_absolute_path(row.example_image_path)
            if absolute.is_file():
                absolute.unlink(missing_ok=True)
        await db.delete(row)


async def create_revision_after_ai_refine(
    db: AsyncSession,
    *,
    library_id: int,
    style_id: str,
    instruction: str,
    snapshot: CoverStyleRevisionSnapshot,
    source: str = "ai_refine",
) -> ContentFactoryCoverStyleRevision:
    resolved = await resolve_style(db, library_id=library_id, style_id=style_id)
    if resolved is None:
        raise CoverStyleRevisionError(f"未知封面风格：{style_id}")

    revision_index = await _next_revision_index(db, style_id=style_id)
    instruction_text = (instruction or "").strip()[:_INSTRUCTION_MAX_LEN] or None

    row = ContentFactoryCoverStyleRevision(
        style_id=style_id,
        revision_index=revision_index,
        source=source,
        instruction=instruction_text,
        snapshot_json=snapshot.to_json(),
        example_image_path=None,
    )
    db.add(row)
    await db.flush()

    example_path = clone_style_example_for_revision(
        style_id=style_id,
        source_stored_path=resolved.example_image_path,
        revision_id=row.id,
        library_id=library_id,
    )
    if example_path:
        row.example_image_path = example_path

    await _prune_old_revisions(db, style_id=style_id)
    await db.flush()
    return row


async def list_revisions(
    db: AsyncSession,
    *,
    style_id: str,
    limit: int = _MAX_REVISIONS_PER_STYLE,
) -> list[ContentFactoryCoverStyleRevision]:
    stmt = (
        select(ContentFactoryCoverStyleRevision)
        .where(ContentFactoryCoverStyleRevision.style_id == style_id)
        .order_by(ContentFactoryCoverStyleRevision.revision_index.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_revision(
    db: AsyncSession,
    *,
    style_id: str,
    revision_id: int,
) -> ContentFactoryCoverStyleRevision | None:
    stmt = select(ContentFactoryCoverStyleRevision).where(
        ContentFactoryCoverStyleRevision.style_id == style_id,
        ContentFactoryCoverStyleRevision.id == revision_id,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def delete_revision(
    db: AsyncSession,
    *,
    style_id: str,
    revision_id: int,
) -> bool:
    row = await get_revision(db, style_id=style_id, revision_id=revision_id)
    if row is None:
        return False
    if row.example_image_path:
        absolute = cover_absolute_path(row.example_image_path)
        if absolute.is_file():
            absolute.unlink(missing_ok=True)
    await db.delete(row)
    await db.flush()
    return True


def revision_snapshot_from_row(row: ContentFactoryCoverStyleRevision) -> CoverStyleRevisionSnapshot:
    raw = row.snapshot_json if isinstance(row.snapshot_json, dict) else {}
    return CoverStyleRevisionSnapshot.from_json(raw)


def revision_created_at_iso(row: ContentFactoryCoverStyleRevision) -> str:
    created = row.created_at
    if isinstance(created, datetime):
        return created.isoformat()
    return str(created)

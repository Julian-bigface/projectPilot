"""内容工厂 — 内置 + 库内封面风格统一注册表。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cover_style_presets import CoverStylePreset, get_builtin_style, list_builtin_styles
from app.services.cover_style_store import (
    get_hidden_style_ids,
    get_style_row,
    list_custom_style_rows,
    row_to_preset,
)
from app.services.cover_style_design_analysis import CoverStyleDesignAnalysis, parse_design_analysis
from app.services.readme_cover_storage import resolve_style_example_path, resolve_style_reference_path


@dataclass(frozen=True)
class ResolvedCoverStyle:
    preset: CoverStylePreset
    style_report: str | None = None
    design_analysis: CoverStyleDesignAnalysis | None = None
    example_image_path: str | None = None
    reference_image_path: str | None = None
    fork_from_style_id: str | None = None
    hidden: bool = False
    created_at: datetime | None = None
    is_builtin: bool = False
    is_deletable: bool = False


def is_deletable(source: str, is_builtin: bool) -> bool:
    return not is_builtin and source in ("manual", "ai_generated")


async def resolve_style(
    db: AsyncSession,
    *,
    library_id: int,
    style_id: str,
) -> ResolvedCoverStyle | None:
    builtin = get_builtin_style(style_id)
    if builtin is not None:
        hidden_ids = await get_hidden_style_ids(db, library_id=library_id)
        example_path = resolve_style_example_path(
            library_id=library_id,
            style_id=style_id,
        )
        return ResolvedCoverStyle(
            preset=builtin,
            example_image_path=example_path,
            is_builtin=True,
            is_deletable=False,
            hidden=style_id in hidden_ids,
        )

    row = await get_style_row(db, style_id=style_id)
    if row is None:
        return None

    return ResolvedCoverStyle(
        preset=row_to_preset(row),
        style_report=row.style_report,
        design_analysis=parse_design_analysis(row.design_analysis),
        example_image_path=resolve_style_example_path(
            library_id=library_id,
            style_id=style_id,
            stored_path=row.example_image_path,
        ),
        reference_image_path=resolve_style_reference_path(
            style_id=style_id,
            stored_path=row.reference_image_path,
        ),
        fork_from_style_id=row.fork_from_style_id,
        hidden=row.hidden,
        created_at=row.created_at,
        is_builtin=False,
        is_deletable=True,
    )


async def list_resolved_styles(
    db: AsyncSession,
    *,
    library_id: int,
    include_hidden: bool = False,
) -> list[ResolvedCoverStyle]:
    hidden_ids = await get_hidden_style_ids(db, library_id=library_id)
    items: list[ResolvedCoverStyle] = []

    for preset in list_builtin_styles():
        hidden = preset.id in hidden_ids
        if hidden and not include_hidden:
            continue
        items.append(
            ResolvedCoverStyle(
                preset=preset,
                example_image_path=resolve_style_example_path(
                    library_id=library_id,
                    style_id=preset.id,
                ),
                is_builtin=True,
                is_deletable=False,
                hidden=hidden,
            )
        )

    for row in await list_custom_style_rows(
        db, library_id=library_id, include_hidden=include_hidden
    ):
        items.append(
            ResolvedCoverStyle(
                preset=row_to_preset(row),
                style_report=row.style_report,
                design_analysis=parse_design_analysis(row.design_analysis),
                example_image_path=resolve_style_example_path(
                    library_id=library_id,
                    style_id=row.style_id,
                    stored_path=row.example_image_path,
                ),
                reference_image_path=resolve_style_reference_path(
                    style_id=row.style_id,
                    stored_path=row.reference_image_path,
                ),
                fork_from_style_id=row.fork_from_style_id,
                hidden=row.hidden,
                created_at=row.created_at,
                is_builtin=False,
                is_deletable=True,
            )
        )

    return items

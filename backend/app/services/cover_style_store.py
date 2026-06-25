"""内容工厂 — 封面风格库 CRUD（全局共享，全库一份）。"""

from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content_factory_cover_style import (
    ContentFactoryCoverStyle,
    ContentFactoryStyleHidden,
)
from app.services.cover_style_design_analysis import CoverStyleDesignAnalysis, parse_design_analysis
from app.services.cover_style_presets import (
    ColorTokens,
    CoverStylePreset,
    FontTokens,
    get_builtin_style,
    is_builtin_style_id,
)

_STYLE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$")


class CoverStyleStoreError(Exception):
    """风格库操作失败。"""


def slugify_style_id_part(value: str, *, max_len: int = 32) -> str:
    text = (value or "style").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    if not text:
        text = "style"
    return text[:max_len].strip("-") or "style"


def generate_style_id(*, prefix: str, label: str) -> str:
    slug = slugify_style_id_part(label)
    digest = hashlib.sha256(f"{prefix}:{label}:{datetime.now(UTC).isoformat()}".encode()).hexdigest()[:6]
    return f"{prefix}-{slug}-{digest}"


def _tokens_from_row(row: ContentFactoryCoverStyle) -> tuple[ColorTokens, FontTokens]:
    ct_raw = row.color_tokens or {}
    ft_raw = row.font_tokens or {}
    try:
        color = ColorTokens.model_validate(ct_raw)
    except Exception:
        color = ColorTokens()
    try:
        font = FontTokens.model_validate(ft_raw)
    except Exception:
        font = FontTokens()
    return color, font


def row_to_preset(row: ContentFactoryCoverStyle) -> CoverStylePreset:
    color, font = _tokens_from_row(row)
    return CoverStylePreset(
        id=row.style_id,
        label=row.label,
        source=row.source if row.source in ("manual", "ai_generated") else "manual",
        prompt_prefix=row.prompt_prefix or "",
        prompt_template=row.prompt_template or "",
        negative_prompt=row.negative_prompt or "",
        color_tokens=color,
        font_tokens=font,
        design_analysis=parse_design_analysis(row.design_analysis),
    )


async def get_hidden_style_ids(db: AsyncSession, *, library_id: int | None = None) -> set[str]:
    del library_id  # 全局：内置隐藏状态全库一致
    stmt = select(ContentFactoryStyleHidden.style_id)
    rows = (await db.execute(stmt)).scalars().all()
    return set(rows)


async def is_style_hidden(
    db: AsyncSession,
    *,
    library_id: int,
    style_id: str,
) -> bool:
    if is_builtin_style_id(style_id):
        hidden_ids = await get_hidden_style_ids(db, library_id=library_id)
        return style_id in hidden_ids
    row = await get_style_row(db, style_id=style_id)
    return bool(row and row.hidden)


async def set_builtin_hidden(
    db: AsyncSession,
    *,
    library_id: int,
    style_id: str,
    hidden: bool,
) -> None:
    if not is_builtin_style_id(style_id):
        raise CoverStyleStoreError("仅内置风格可通过 hidden 表隐藏。")
    if hidden:
        await db.execute(
            delete(ContentFactoryStyleHidden).where(
                ContentFactoryStyleHidden.style_id == style_id,
            )
        )
        db.add(
            ContentFactoryStyleHidden(
                project_library_id=library_id,
                style_id=style_id,
            )
        )
    else:
        await db.execute(
            delete(ContentFactoryStyleHidden).where(
                ContentFactoryStyleHidden.style_id == style_id,
            )
        )


async def get_style_row(
    db: AsyncSession,
    *,
    library_id: int | None = None,
    style_id: str,
) -> ContentFactoryCoverStyle | None:
    del library_id
    stmt = select(ContentFactoryCoverStyle).where(
        ContentFactoryCoverStyle.style_id == style_id,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_custom_style_rows(
    db: AsyncSession,
    *,
    library_id: int | None = None,
    include_hidden: bool = False,
) -> list[ContentFactoryCoverStyle]:
    del library_id
    stmt = select(ContentFactoryCoverStyle)
    if not include_hidden:
        stmt = stmt.where(ContentFactoryCoverStyle.hidden.is_(False))
    stmt = stmt.order_by(ContentFactoryCoverStyle.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def create_style(
    db: AsyncSession,
    *,
    library_id: int,
    style_id: str,
    label: str,
    source: str,
    prompt_prefix: str,
    prompt_template: str,
    negative_prompt: str,
    color_tokens: ColorTokens | None = None,
    font_tokens: FontTokens | None = None,
    style_report: str | None = None,
    design_analysis: CoverStyleDesignAnalysis | None = None,
    fork_from_style_id: str | None = None,
    example_image_path: str | None = None,
    reference_image_path: str | None = None,
) -> ContentFactoryCoverStyle:
    sid = style_id.strip()
    if not _STYLE_ID_RE.match(sid):
        raise CoverStyleStoreError("style_id 格式无效（小写字母、数字、连字符）。")
    if is_builtin_style_id(sid):
        raise CoverStyleStoreError("style_id 与内置风格冲突。")

    row = ContentFactoryCoverStyle(
        style_id=sid,
        project_library_id=library_id,
        label=label.strip() or sid,
        source=source,
        prompt_prefix=prompt_prefix.strip(),
        prompt_template=prompt_template.strip(),
        negative_prompt=negative_prompt.strip(),
        color_tokens=(color_tokens or ColorTokens()).model_dump(),
        font_tokens=(font_tokens or FontTokens()).model_dump(),
        style_report=style_report,
        design_analysis=design_analysis.model_dump() if design_analysis else None,
        fork_from_style_id=fork_from_style_id,
        example_image_path=example_image_path,
        reference_image_path=reference_image_path,
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError as err:
        raise CoverStyleStoreError(f"风格 id 已存在：{sid}") from err
    return row


async def update_style(
    db: AsyncSession,
    row: ContentFactoryCoverStyle,
    *,
    label: str | None = None,
    prompt_prefix: str | None = None,
    prompt_template: str | None = None,
    negative_prompt: str | None = None,
    color_tokens: ColorTokens | None = None,
    font_tokens: FontTokens | None = None,
    style_report: str | None = None,
    design_analysis: CoverStyleDesignAnalysis | None = None,
    example_image_path: str | None = None,
    hidden: bool | None = None,
) -> ContentFactoryCoverStyle:
    if label is not None:
        row.label = label.strip() or row.label
    if prompt_prefix is not None:
        row.prompt_prefix = prompt_prefix.strip()
    if prompt_template is not None:
        row.prompt_template = prompt_template.strip()
    if negative_prompt is not None:
        row.negative_prompt = negative_prompt.strip()
    if color_tokens is not None:
        row.color_tokens = color_tokens.model_dump()
    if font_tokens is not None:
        row.font_tokens = font_tokens.model_dump()
    if style_report is not None:
        row.style_report = style_report
    if design_analysis is not None:
        row.design_analysis = design_analysis.model_dump()
    if example_image_path is not None:
        row.example_image_path = example_image_path
    if hidden is not None:
        row.hidden = hidden
    row.updated_at = datetime.now(UTC)
    await db.flush()
    return row


async def count_styles_referencing_asset_path(
    db: AsyncSession,
    *,
    path: str,
    exclude_style_id: str | None = None,
) -> int:
    """统计仍引用同一资产相对路径的其他风格数量。"""
    normalized = path.strip()
    if not normalized:
        return 0
    stmt = select(func.count()).select_from(ContentFactoryCoverStyle).where(
        or_(
            ContentFactoryCoverStyle.example_image_path == normalized,
            ContentFactoryCoverStyle.reference_image_path == normalized,
        )
    )
    if exclude_style_id:
        stmt = stmt.where(ContentFactoryCoverStyle.style_id != exclude_style_id)
    return int((await db.execute(stmt)).scalar_one())


async def delete_style(
    db: AsyncSession,
    *,
    library_id: int | None = None,
    style_id: str,
) -> ContentFactoryCoverStyle | None:
    del library_id
    if is_builtin_style_id(style_id):
        raise CoverStyleStoreError("内置风格不可删除。")
    row = await get_style_row(db, style_id=style_id)
    if row is None:
        return None
    await db.delete(row)
    await db.flush()
    return row

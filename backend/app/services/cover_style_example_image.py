"""内容工厂 — 风格示例图生成（recommend_image）。"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cover_style_example import build_style_example_prompt
from app.services.cover_style_registry import resolve_style
from app.services.cover_style_store import CoverStyleStoreError, update_style
from app.services.recommend_image import ImageProviderError, generate_image_bytes
from app.services.readme_cover_storage import save_style_example_png
from app.services.settings_ai import resolve_ai_runtime_config


class CoverStyleExampleError(Exception):
    """风格示例图生成失败。"""


async def generate_style_example_image(
    db: AsyncSession,
    *,
    library_id: int,
    style_id: str,
    size_preset_id: str = "xiaohongshu-34",
    force: bool = False,
) -> str:
    resolved = await resolve_style(db, library_id=library_id, style_id=style_id)
    if resolved is None:
        raise CoverStyleExampleError(f"未知封面风格：{style_id}")

    _provider, base_url, model, api_key = await resolve_ai_runtime_config(
        db,
        scenario_id="recommend_image",
    )
    if not api_key:
        raise CoverStyleExampleError(
            "未配置生图 API Key：请在设置 → AI → 推荐配图中配置。"
        )

    built = build_style_example_prompt(style=resolved.preset)
    try:
        png_bytes = await generate_image_bytes(
            base_url=base_url,
            api_key=api_key,
            model=model,
            prompt=built.image_prompt,
            size_preset_id=size_preset_id,
            negative_prompt=built.negative_prompt,
        )
    except ImageProviderError as err:
        raise CoverStyleExampleError(str(err)) from err

    relative = save_style_example_png(
        png_bytes,
        library_id=library_id,
        style_id=style_id,
        force=force,
    )

    if not resolved.is_builtin:
        from app.services.cover_style_store import get_style_row

        row = await get_style_row(db, library_id=library_id, style_id=style_id)
        if row is not None:
            await update_style(db, row, example_image_path=relative)

    return relative

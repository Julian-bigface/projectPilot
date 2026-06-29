"""内容工厂 — 风格示例图生成（recommend_image）。"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cover_style_example import build_style_example_prompt
from app.services.cover_style_presets import ColorTokens, CoverStylePreset, FontTokens
from app.services.cover_style_registry import resolve_style
from app.services.cover_style_store import CoverStyleStoreError, update_style
from app.services.recommend_image import ImageProviderError, generate_image_bytes
from app.services.readme_cover_storage import save_style_example_png
from app.services.settings_ai import resolve_ai_runtime_config


class CoverStyleExampleError(Exception):
    """风格示例图生成失败。"""


def apply_style_prompt_override(
    preset: CoverStylePreset,
    *,
    prompt_prefix: str | None = None,
    prompt_template: str | None = None,
    negative_prompt: str | None = None,
    design_analysis=None,
    color_tokens: ColorTokens | None = None,
    font_tokens: FontTokens | None = None,
) -> CoverStylePreset:
    updates: dict = {}
    if prompt_prefix is not None:
        updates["prompt_prefix"] = prompt_prefix.strip()
    if prompt_template is not None:
        updates["prompt_template"] = prompt_template.strip()
    if negative_prompt is not None:
        updates["negative_prompt"] = negative_prompt.strip()
    if design_analysis is not None:
        updates["design_analysis"] = design_analysis
    if color_tokens is not None:
        updates["color_tokens"] = color_tokens
    if font_tokens is not None:
        updates["font_tokens"] = font_tokens
    if not updates:
        return preset
    return preset.model_copy(update=updates)


async def generate_style_example_image(
    db: AsyncSession,
    *,
    library_id: int,
    style_id: str,
    size_preset_id: str = "xiaohongshu-34",
    force: bool = False,
    prompt_prefix: str | None = None,
    prompt_template: str | None = None,
    negative_prompt: str | None = None,
    design_analysis=None,
    color_tokens: ColorTokens | None = None,
    font_tokens: FontTokens | None = None,
) -> str:
    resolved = await resolve_style(db, library_id=library_id, style_id=style_id)
    if resolved is None:
        raise CoverStyleExampleError(f"未知封面风格：{style_id}")

    style_preset = apply_style_prompt_override(
        resolved.preset,
        prompt_prefix=prompt_prefix,
        prompt_template=prompt_template,
        negative_prompt=negative_prompt,
        design_analysis=design_analysis,
        color_tokens=color_tokens,
        font_tokens=font_tokens,
    )

    _provider, base_url, model, api_key = await resolve_ai_runtime_config(
        db,
        scenario_id="recommend_image",
    )
    if not api_key:
        raise CoverStyleExampleError(
            "未配置生图 API Key：请在设置 → AI → 推荐配图中配置。"
        )

    built = build_style_example_prompt(style=style_preset)
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

"""内容工厂 — AI 生成封面风格定义（recommend_cover_style 场景）。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cover_style_design_analysis import CoverStyleDesignAnalysis
from app.services.cover_prompt import sanitize_prompt_template_braces
from app.services.cover_style_presets import ColorTokens, FontTokens
from app.services.cover_style_registry import resolve_style
from app.services.cover_style_store import CoverStyleStoreError, create_style, generate_style_id
from app.services.cover_style_vision import CoverStyleVisionError, assert_vision_model
from app.services.llm import get_llm_provider
from app.services.llm.json_extract import extract_first_json_object
from app.services.llm.provider import LlmError
from app.services.readme_cover_storage import (
    ReadmeCoverError,
    archive_style_reference,
    delete_reference_upload,
    load_reference_bytes,
)
from app.services.settings_ai import resolve_ai_runtime_config, resolve_ai_scenario_preset_id

_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent / "prompts" / "content_factory" / "cover" / "generate_style.txt"
)
_NO_BRIEF_PLACEHOLDER = "（用户未提供文字，请仅依据参考图分析）"


class GeneratedCoverStylePayload(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    design_analysis: CoverStyleDesignAnalysis = Field(default_factory=CoverStyleDesignAnalysis)
    prompt_prefix: str = Field(min_length=1)
    prompt_template: str = Field(min_length=1)
    negative_prompt: str = Field(default="")
    color_tokens: ColorTokens = Field(default_factory=ColorTokens)
    font_tokens: FontTokens = Field(default_factory=FontTokens)
    style_report: str = Field(default="")

    @field_validator("prompt_template")
    @classmethod
    def _sanitize_prompt_template(cls, value: str) -> str:
        return sanitize_prompt_template_braces(value.strip())


class CoverStyleGenerateError(Exception):
    """AI 风格生成失败。"""


def _load_prompt_template() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


async def _fork_context(
    db: AsyncSession,
    *,
    library_id: int,
    fork_from_style_id: str | None,
) -> str:
    if not fork_from_style_id:
        return "（无 fork 源风格）"
    resolved = await resolve_style(db, library_id=library_id, style_id=fork_from_style_id)
    if resolved is None:
        return f"（fork 源 {fork_from_style_id} 未找到，请忽略）"
    p = resolved.preset
    return (
        f"Fork 源风格「{p.label}」：\n"
        f"prompt_prefix: {p.prompt_prefix}\n"
        f"prompt_template: {p.prompt_template}\n"
        f"negative_prompt: {p.negative_prompt}"
    )


async def _prepare_cover_style_generation(
    db: AsyncSession,
    *,
    library_id: int,
    generation_brief: str | None = None,
    fork_from_style_id: str | None = None,
    reference_id: str | None = None,
) -> tuple[str, str, str, str, str, list[tuple[bytes, str]] | None, str]:
    brief = (generation_brief or "").strip()
    ref_id = (reference_id or "").strip()
    if not brief and not ref_id:
        raise CoverStyleGenerateError("请填写风格描述或上传参考图。")

    provider_name, base_url, model, api_key = await resolve_ai_runtime_config(
        db,
        scenario_id="recommend_cover_style",
    )
    preset_id = await resolve_ai_scenario_preset_id(db, scenario_id="recommend_cover_style")
    if not api_key:
        raise CoverStyleGenerateError(
            "未配置文本 LLM API Key：请在设置 → AI → 封面风格生成中配置。"
        )

    user_images: list[tuple[bytes, str]] | None = None
    if ref_id:
        try:
            assert_vision_model(model, provider_id=preset_id)
        except CoverStyleVisionError as err:
            raise CoverStyleGenerateError(str(err)) from err
        try:
            ref_bytes, ref_mime = load_reference_bytes(ref_id)
            user_images = [(ref_bytes, ref_mime)]
        except ReadmeCoverError as err:
            raise CoverStyleGenerateError(str(err)) from err

    fork_ctx = await _fork_context(
        db,
        library_id=library_id,
        fork_from_style_id=fork_from_style_id,
    )
    brief_for_prompt = brief or _NO_BRIEF_PLACEHOLDER
    reference_section = (
        "用户已上传灵感参考图（见本条消息中的图片）。"
        "你必须先完成 design_analysis 十维结构化拆解，再填写 prompt 字段；"
        "将 layout、visual_components、unique_memory_point 写入 prompt_template（中文），"
        "将 mood、whitespace、design_system 写入 prompt_prefix；"
        "color_tokens 须与 color_strategy 一致。"
        "借鉴视觉语言，抽象转写，不要 OCR 复制图中文字或 logo，不要照搬 PPT/多页信息图结构。"
        if user_images
        else "（用户未上传参考图：design_analysis 各字段可留空，主要依据文字描述生成。）"
    )
    user_prompt = (
        _load_prompt_template()
        .replace("{{fork_context}}", fork_ctx)
        .replace("{{generation_brief}}", brief_for_prompt)
        .replace("{{reference_image_section}}", reference_section)
    )
    return provider_name, base_url, model, api_key, user_prompt, user_images, preset_id


async def generate_cover_style_payload(
    db: AsyncSession,
    *,
    library_id: int,
    generation_brief: str | None = None,
    fork_from_style_id: str | None = None,
    reference_id: str | None = None,
) -> GeneratedCoverStylePayload:
    try:
        provider_name, base_url, model, api_key, user_prompt, user_images, _preset = (
            await _prepare_cover_style_generation(
                db,
                library_id=library_id,
                generation_brief=generation_brief,
                fork_from_style_id=fork_from_style_id,
                reference_id=reference_id,
            )
        )
    except CoverStyleGenerateError:
        raise

    llm = get_llm_provider(provider_name, base_url=base_url, api_key=api_key, model=model)
    try:
        raw = await llm.complete(
            system="你是视觉设计系统分析师，只输出 JSON object。prompt_template 正文须用中文。",
            user=user_prompt,
            temperature=0.4,
            max_tokens=4096,
            json_mode=True,
            user_images=user_images,
        )
        data = extract_first_json_object(raw)
        return GeneratedCoverStylePayload.model_validate(data)
    except (LlmError, ValidationError) as err:
        raise CoverStyleGenerateError(f"AI 风格生成失败：{err}") from err


async def iter_cover_style_generate_stream(
    db: AsyncSession,
    *,
    library_id: int,
    generation_brief: str | None = None,
    fork_from_style_id: str | None = None,
    reference_id: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    yield {"event": "start"}
    try:
        provider_name, base_url, model, api_key, user_prompt, user_images, _preset = (
            await _prepare_cover_style_generation(
                db,
                library_id=library_id,
                generation_brief=generation_brief,
                fork_from_style_id=fork_from_style_id,
                reference_id=reference_id,
            )
        )
    except CoverStyleGenerateError as err:
        yield {"event": "error", "detail": str(err)}
        return

    llm = get_llm_provider(provider_name, base_url=base_url, api_key=api_key, model=model)
    accumulated = ""
    try:
        async for chunk in llm.complete_stream(
            system="你是视觉设计系统分析师，只输出 JSON object。prompt_template 正文须用中文。",
            user=user_prompt,
            temperature=0.4,
            max_tokens=4096,
            json_mode=True,
            user_images=user_images,
        ):
            accumulated += chunk
            yield {"event": "delta", "text": chunk}
        data = extract_first_json_object(accumulated)
        payload = GeneratedCoverStylePayload.model_validate(data)
        yield {"event": "done", "payload": payload.model_dump()}
    except (LlmError, ValidationError, CoverStyleGenerateError) as err:
        yield {"event": "error", "detail": f"AI 风格生成失败：{err}"}


async def save_generated_style(
    db: AsyncSession,
    *,
    library_id: int,
    payload: GeneratedCoverStylePayload,
    fork_from_style_id: str | None = None,
    reference_id: str | None = None,
) -> tuple[str, str]:
    style_id = generate_style_id(prefix="ai", label=payload.name)
    ref_id = (reference_id or "").strip()
    reference_image_path: str | None = None
    reference_bytes: bytes | None = None
    if ref_id:
        try:
            reference_bytes, _mime = load_reference_bytes(ref_id)
        except ReadmeCoverError as err:
            raise CoverStyleGenerateError(str(err)) from err

    try:
        row = await create_style(
            db,
            library_id=library_id,
            style_id=style_id,
            label=payload.name,
            source="ai_generated",
            prompt_prefix=payload.prompt_prefix,
            prompt_template=payload.prompt_template,
            negative_prompt=payload.negative_prompt,
            color_tokens=payload.color_tokens,
            font_tokens=payload.font_tokens,
            style_report=payload.style_report or None,
            design_analysis=payload.design_analysis,
            fork_from_style_id=fork_from_style_id,
            reference_image_path=reference_image_path,
        )
    except CoverStyleStoreError as err:
        raise CoverStyleGenerateError(str(err)) from err

    if reference_bytes is not None:
        try:
            reference_image_path = archive_style_reference(reference_bytes, style_id=style_id)
            row.reference_image_path = reference_image_path
            await db.flush()
            delete_reference_upload(ref_id)
        except ReadmeCoverError as err:
            raise CoverStyleGenerateError(str(err)) from err

    return style_id, payload.name

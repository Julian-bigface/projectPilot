"""内容工厂 — AI 微调封面风格（模板 / 整套风格）。"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cover_prompt import sanitize_prompt_template_braces
from app.services.cover_style_design_analysis import CoverStyleDesignAnalysis
from app.services.cover_style_generate import CoverStyleGenerateError
from app.services.cover_style_presets import ColorTokens, FontTokens
from app.services.llm import get_llm_provider
from app.services.llm.json_extract import extract_first_json_object
from app.services.llm.provider import LlmError
from app.services.settings_ai import resolve_ai_runtime_config

_TEMPLATE_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent
    / "prompts"
    / "content_factory"
    / "cover"
    / "refine_prompt_template.txt"
)
_STYLE_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent
    / "prompts"
    / "content_factory"
    / "cover"
    / "refine_style.txt"
)

_REQUIRED_PLACEHOLDERS = (
    "{project_name}",
    "{project_description}",
    "{headline}",
    "{cover_texts}",
    "{highlight_tags}",
    "{project_language}",
    "{project_stars}",
)


class RefinePromptTemplateResult(BaseModel):
    prompt_template: str = Field(min_length=1)


class RefineCoverStyleResult(BaseModel):
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


def _load_template_prompt() -> str:
    return _TEMPLATE_PROMPT_PATH.read_text(encoding="utf-8")


def _load_style_prompt() -> str:
    return _STYLE_PROMPT_PATH.read_text(encoding="utf-8")


def _validate_placeholders(template: str) -> None:
    missing = [p for p in _REQUIRED_PLACEHOLDERS if p not in template]
    if missing:
        joined = ", ".join(missing)
        raise CoverStyleGenerateError(f"修订后的模板缺少占位符：{joined}")


async def refine_prompt_template(
    db: AsyncSession,
    *,
    prompt_template: str,
    instruction: str,
    prompt_prefix: str | None = None,
) -> str:
    current = prompt_template.strip()
    user_instruction = instruction.strip()
    if not current:
        raise CoverStyleGenerateError("当前提示词模板为空。")
    if not user_instruction:
        raise CoverStyleGenerateError("请描述希望如何修改模板。")

    provider_name, base_url, model, api_key = await resolve_ai_runtime_config(
        db,
        scenario_id="recommend_cover_style",
    )
    if not api_key:
        raise CoverStyleGenerateError(
            "未配置文本 LLM API Key：请在设置 → AI → 封面风格生成中配置。"
        )

    prefix_ctx = (prompt_prefix or "").strip() or "（未提供）"
    user_prompt = (
        _load_template_prompt()
        .replace("{{prompt_prefix}}", prefix_ctx)
        .replace("{{prompt_template}}", current)
        .replace("{{instruction}}", user_instruction)
    )

    llm = get_llm_provider(provider_name, base_url=base_url, api_key=api_key, model=model)
    try:
        raw = await llm.complete(
            system="你是 prompt 编辑助手，只输出 JSON object。",
            user=user_prompt,
            temperature=0.3,
            max_tokens=2048,
            json_mode=True,
        )
        data = extract_first_json_object(raw)
        result = RefinePromptTemplateResult.model_validate(data)
    except (LlmError, ValidationError) as err:
        raise CoverStyleGenerateError(f"AI 调整模板失败：{err}") from err

    revised = result.prompt_template.strip()
    _validate_placeholders(revised)
    return revised


async def refine_cover_style(
    db: AsyncSession,
    *,
    instruction: str,
    label: str | None = None,
    design_analysis: CoverStyleDesignAnalysis | None = None,
    prompt_prefix: str,
    prompt_template: str,
    negative_prompt: str = "",
    color_tokens: ColorTokens | None = None,
    font_tokens: FontTokens | None = None,
    style_report: str | None = None,
) -> RefineCoverStyleResult:
    user_instruction = instruction.strip()
    if not user_instruction:
        raise CoverStyleGenerateError("请描述希望如何修改风格。")

    provider_name, base_url, model, api_key = await resolve_ai_runtime_config(
        db,
        scenario_id="recommend_cover_style",
    )
    if not api_key:
        raise CoverStyleGenerateError(
            "未配置文本 LLM API Key：请在设置 → AI → 封面风格生成中配置。"
        )

    current_style = {
        "label": (label or "").strip() or "（未命名）",
        "design_analysis": (design_analysis or CoverStyleDesignAnalysis()).model_dump(),
        "prompt_prefix": prompt_prefix.strip(),
        "prompt_template": prompt_template.strip(),
        "negative_prompt": negative_prompt.strip(),
        "color_tokens": (color_tokens or ColorTokens()).model_dump(),
        "font_tokens": (font_tokens or FontTokens()).model_dump(),
        "style_report": (style_report or "").strip(),
    }
    user_prompt = (
        _load_style_prompt()
        .replace("{{current_style}}", json.dumps(current_style, ensure_ascii=False, indent=2))
        .replace("{{instruction}}", user_instruction)
    )

    llm = get_llm_provider(provider_name, base_url=base_url, api_key=api_key, model=model)
    try:
        raw = await llm.complete(
            system="你是视觉设计系统分析师，只输出 JSON object。prompt_template 正文须用中文。",
            user=user_prompt,
            temperature=0.35,
            max_tokens=4096,
            json_mode=True,
        )
        data = extract_first_json_object(raw)
        result = RefineCoverStyleResult.model_validate(data)
    except (LlmError, ValidationError) as err:
        raise CoverStyleGenerateError(f"AI 调整风格失败：{err}") from err

    _validate_placeholders(result.prompt_template)
    return result

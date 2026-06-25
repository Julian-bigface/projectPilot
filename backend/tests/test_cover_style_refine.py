"""cover_style_refine 单元测试。"""

import json
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cover_style_generate import CoverStyleGenerateError
from app.services.cover_style_refine import refine_cover_style, refine_prompt_template


@pytest.mark.asyncio
async def test_refine_prompt_template_success(db_session: AsyncSession) -> None:
    revised = (
        "Main visual updated. Project: {project_name} — {project_description}. "
        "Headline「{headline}」; sub「{cover_texts}」. "
        "Tags: {highlight_tags}. Lang {project_language}, stars {project_stars}."
    )
    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(
        return_value=json.dumps({"prompt_template": revised}, ensure_ascii=False)
    )

    with (
        patch(
            "app.services.cover_style_refine.resolve_ai_runtime_config",
            new=AsyncMock(return_value=("openai", "https://api.example.com/v1", "gpt-4o", "sk-test")),
        ),
        patch("app.services.cover_style_refine.get_llm_provider", return_value=mock_llm),
    ):
        result = await refine_prompt_template(
            db_session,
            prompt_template="Old template {project_name} {headline}",
            instruction="加强杂志感，标题更突出",
            prompt_prefix="1242x1660, 3:4 cover",
        )

    assert result == revised
    mock_llm.complete.assert_awaited_once()


@pytest.mark.asyncio
async def test_refine_prompt_template_rejects_missing_placeholders(db_session: AsyncSession) -> None:
    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value='{"prompt_template": "only {project_name} here"}')

    with (
        patch(
            "app.services.cover_style_refine.resolve_ai_runtime_config",
            new=AsyncMock(return_value=("openai", "https://api.example.com/v1", "gpt-4o", "sk-test")),
        ),
        patch("app.services.cover_style_refine.get_llm_provider", return_value=mock_llm),
    ):
        with pytest.raises(CoverStyleGenerateError, match="缺少占位符"):
            await refine_prompt_template(
                db_session,
                prompt_template="Old {project_name}",
                instruction="简化",
            )


@pytest.mark.asyncio
async def test_refine_cover_style_success(db_session: AsyncSession) -> None:
    revised_template = (
        "主视觉：{project_name}，{project_description}。"
        "标题「{headline}」；副文案「{cover_texts}」；标签 {highlight_tags}；"
        "语言 {project_language}；Star {project_stars}。"
    )
    payload = {
        "design_analysis": {
            "design_category": "潮流插画海报",
            "design_system": "Streetwear editorial",
            "overall_mood": "叛逆、潮牌",
            "layout_system": {"structure": "居中聚焦"},
            "typography_strategy": {"title_ratio": "约 35%"},
            "information_density": "中",
            "whitespace_usage": "四周大幅留白",
            "visual_components": ["方形红底插画区块"],
            "unique_memory_point": "粗粝手绘毛边边框",
        },
        "prompt_prefix": "1242x1660, 3:4 vertical cover, streetwear poster",
        "prompt_template": revised_template,
        "negative_prompt": "cheap gradient, garbled text",
        "color_tokens": {"background": "#111111", "accent": "#E53935", "text_safe": "#FFFFFF"},
        "font_tokens": {"heading": "sans", "body": "sans", "accent": "display"},
        "style_report": "更强调标题与街头气质。",
    }
    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value=json.dumps(payload, ensure_ascii=False))

    with (
        patch(
            "app.services.cover_style_refine.resolve_ai_runtime_config",
            new=AsyncMock(return_value=("openai", "https://api.example.com/v1", "gpt-4o", "sk-test")),
        ),
        patch("app.services.cover_style_refine.get_llm_provider", return_value=mock_llm),
    ):
        result = await refine_cover_style(
            db_session,
            instruction="标题再大一点，减少红色面积",
            label="ai-style-test",
            prompt_prefix="1242x1660, 3:4 cover",
            prompt_template=(
                "主视觉：{project_name}，{project_description}。"
                "标题「{headline}」；副文案「{cover_texts}」；标签 {highlight_tags}；"
                "语言 {project_language}；Star {project_stars}。"
            ),
        )

    assert result.prompt_template == revised_template
    assert result.design_analysis.design_category == "潮流插画海报"
    assert result.style_report == "更强调标题与街头气质。"
    mock_llm.complete.assert_awaited_once()

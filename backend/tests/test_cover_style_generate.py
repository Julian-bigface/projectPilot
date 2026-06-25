"""封面风格 AI 生成（含参考图 vision）测试。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.services.cover_style_vision import is_vision_model
from tests.conftest import make_test_cover_png


def test_is_vision_model_openai_preset() -> None:
    assert is_vision_model("gpt-4o", provider_id="openai")
    assert not is_vision_model("deepseek-chat", provider_id="deepseek")


def test_is_vision_model_minimax_m3() -> None:
    assert is_vision_model("MiniMax-M3", provider_id="minimax-cn")
    assert not is_vision_model("MiniMax-M2.5-highspeed", provider_id="minimax-cn")


async def _setup_ai_config(client: AsyncClient) -> None:
    res = await client.put(
        "/settings/ai/config",
        json={
            "providers": [
                {
                    "id": "default",
                    "name": "OpenAI",
                    "preset_id": "openai",
                    "base_url": "https://api.openai.com/v1",
                    "models": ["gpt-4o"],
                    "default_model": "gpt-4o",
                    "api_key": "sk-testkey1234567890",
                }
            ],
            "default_provider_id": "default",
            "scenarios": {
                "tag_classification": {"provider_id": "default", "model": "gpt-4o"},
                "recommend_copy": {"provider_id": "default", "model": "gpt-4o"},
                "recommend_image": {"provider_id": "default", "model": None},
                "recommend_cover_style": {"provider_id": "default", "model": "gpt-4o"},
            },
        },
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_generate_with_reference_id_only(
    client: AsyncClient,
    tmp_path,
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    await _setup_ai_config(client)
    lib_res = await client.post("/project-libraries", json={"name": "GenLib"})
    lib_id = lib_res.json()["id"]
    base = f"/project-libraries/{lib_id}/content-factory"

    upload_res = await client.post(
        f"{base}/cover-styles/reference-upload",
        files={"file": ("ref.png", make_test_cover_png(), "image/png")},
    )
    reference_id = upload_res.json()["reference_id"]

    style_json = {
        "name": "参考图杂志风",
        "design_analysis": {
            "design_category": "杂志",
            "design_system": "Editorial",
            "typography_strategy": {
                "title_ratio": "35%",
                "weight": "Bold",
                "hierarchy_levels": "3层",
            },
            "layout_system": {"structure": "上下分割", "alignment": "左对齐"},
            "color_strategy": {
                "main_color": "#111111",
                "accent_color": "#39ff14",
                "background_note": "纯色深底",
            },
            "information_density": "中",
            "whitespace_usage": "标准网格",
            "visual_components": ["标签药丸", "细分割线"],
            "overall_mood": "专业理性",
            "unique_memory_point": "左侧色条强调标题",
        },
        "prompt_prefix": "1242x1660, 3:4 vertical portrait cover, strict margins",
        "prompt_template": "主视觉：{project_name} 推广封面。主标题「{headline}」；标签 {highlight_tags}；语言 {project_language}；Star {project_stars}；副文案「{cover_texts}」；简介 {project_description}",
        "negative_prompt": "cheap gradient",
        "color_tokens": {"background": "#111111", "accent": "#39ff14", "text_safe": "#ffffff"},
        "font_tokens": {"heading": "sans", "body": "sans", "accent": "mono"},
        "style_report": "适合科技推广",
    }

    with patch(
        "app.services.cover_style_generate.get_llm_provider",
    ) as mock_get_provider:
        mock_llm = AsyncMock()
        mock_llm.complete = AsyncMock(return_value=__import__("json").dumps(style_json))
        mock_get_provider.return_value = mock_llm

        gen_res = await client.post(
            f"{base}/cover-styles/generate",
            json={
                "reference_id": reference_id,
                "generate_example": False,
                "auto_save": True,
            },
        )

    assert gen_res.status_code == 200, gen_res.text
    body = gen_res.json()
    assert body["label"] == "参考图杂志风"
    assert body["reference_image_url"] is not None
    mock_llm.complete.assert_awaited_once()
    assert mock_llm.complete.await_args.kwargs.get("user_images")

    ref_res = await client.get(body["reference_image_url"].split("?")[0].removeprefix("/api"))
    assert ref_res.status_code == 200


@pytest.mark.asyncio
async def test_generate_reference_requires_vision_model(
    client: AsyncClient,
    tmp_path,
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    res = await client.put(
        "/settings/ai/config",
        json={
            "providers": [
                {
                    "id": "default",
                    "name": "DeepSeek",
                    "preset_id": "deepseek",
                    "base_url": "https://api.deepseek.com/v1",
                    "models": ["deepseek-chat"],
                    "default_model": "deepseek-chat",
                    "api_key": "sk-testkey1234567890",
                }
            ],
            "default_provider_id": "default",
            "scenarios": {
                "tag_classification": {"provider_id": "default", "model": "deepseek-chat"},
                "recommend_copy": {"provider_id": "default", "model": "deepseek-chat"},
                "recommend_image": {"provider_id": "default", "model": None},
                "recommend_cover_style": {"provider_id": "default", "model": "deepseek-chat"},
            },
        },
    )
    assert res.status_code == 200

    lib_res = await client.post("/project-libraries", json={"name": "VisionFailLib"})
    lib_id = lib_res.json()["id"]
    base = f"/project-libraries/{lib_id}/content-factory"

    upload_res = await client.post(
        f"{base}/cover-styles/reference-upload",
        files={"file": ("ref.png", make_test_cover_png(), "image/png")},
    )
    reference_id = upload_res.json()["reference_id"]

    gen_res = await client.post(
        f"{base}/cover-styles/generate",
        json={"reference_id": reference_id, "generate_example": False},
    )
    assert gen_res.status_code == 424
    assert "视觉" in gen_res.json()["detail"]

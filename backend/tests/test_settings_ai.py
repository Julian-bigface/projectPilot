"""AI 设置 API 测试。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_settings_defaults(client: AsyncClient) -> None:
    res = await client.get("/settings/ai")
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "openai_compatible"
    assert data["preset_id"] == "minimax-cn"
    assert data["base_url"] == "https://api.minimaxi.com/v1"
    assert data["model"] == "MiniMax-M2.5-highspeed"
    assert data["has_api_key"] is False


@pytest.mark.asyncio
async def test_ai_config_defaults(client: AsyncClient) -> None:
    res = await client.get("/settings/ai/config")
    assert res.status_code == 200
    data = res.json()
    assert len(data["providers"]) == 1
    provider = data["providers"][0]
    assert provider["preset_id"] == "minimax-cn"
    assert provider["is_default"] is True
    assert data["default_provider_id"] == provider["id"]
    assert data["scenarios"]["tag_classification"]["provider_id"] == provider["id"]
    assert "tag_classification" in data["scenario_labels"]


@pytest.mark.asyncio
async def test_ai_config_put_multi_provider(client: AsyncClient) -> None:
    res = await client.put(
        "/settings/ai/config",
        json={
            "providers": [
                {
                    "id": "default",
                    "name": "MiniMax",
                    "preset_id": "minimax-cn",
                    "base_url": "https://api.minimaxi.com/v1",
                    "models": ["MiniMax-M2.5-highspeed", "MiniMax-M3"],
                    "default_model": "MiniMax-M2.5-highspeed",
                    "api_key": "sk-testkey1234567890",
                },
                {
                    "name": "DeepSeek",
                    "preset_id": "deepseek",
                    "base_url": "https://api.deepseek.com/v1",
                    "models": ["deepseek-chat"],
                    "default_model": "deepseek-chat",
                },
            ],
            "default_provider_id": "default",
            "scenarios": {
                "tag_classification": {
                    "provider_id": "default",
                    "model": "MiniMax-M3",
                },
                "recommend_copy": {
                    "provider_id": "default",
                    "model": "MiniMax-M2.5-highspeed",
                },
                "recommend_image": {
                    "provider_id": "default",
                    "model": None,
                },
            },
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["providers"]) == 2
    assert data["scenarios"]["tag_classification"]["model"] == "MiniMax-M3"
    assert data["providers"][0]["has_api_key"] is True
    assert data["providers"][0]["api_key_preview"] == "7890"

    get_res = await client.get("/settings/ai/config")
    assert get_res.json()["providers"][0]["has_api_key"] is True


@pytest.mark.asyncio
async def test_ai_settings_put_and_key_preview(client: AsyncClient) -> None:
    res = await client.put(
        "/settings/ai",
        json={
            "preset_id": "minimax-cn",
            "base_url": "https://api.minimaxi.com/v1",
            "model": "MiniMax-M2.5",
            "api_key": "sk-testkey1234567890",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["base_url"] == "https://api.minimaxi.com/v1"
    assert data["model"] == "MiniMax-M2.5"
    assert data["has_api_key"] is True
    assert data["api_key_preview"] == "7890"
    assert data["api_key_length"] == len("sk-testkey1234567890")

    config_res = await client.get("/settings/ai/config")
    default_provider = config_res.json()["providers"][0]
    assert default_provider["has_api_key"] is True


@pytest.mark.asyncio
async def test_ai_test_without_key(client: AsyncClient) -> None:
    res = await client.post("/settings/ai/test")
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is False
    assert "API Key" in (data["message"] or "")


@pytest.mark.asyncio
async def test_ai_test_with_saved_key(client: AsyncClient) -> None:
    await client.put("/settings/ai", json={"api_key": "sk-testkey1234567890"})

    with patch(
        "app.api.settings.get_llm_provider",
    ) as mock_factory:
        mock_provider = AsyncMock()
        mock_provider.complete = AsyncMock(return_value="OK")
        mock_factory.return_value = mock_provider

        res = await client.post("/settings/ai/test")

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["sample"] == "OK"
    mock_provider.complete.assert_awaited_once()


@pytest.mark.asyncio
async def test_ai_test_recommend_image_scenario(client: AsyncClient) -> None:
    await client.put(
        "/settings/ai/config",
        json={
            "providers": [
                {
                    "id": "default",
                    "name": "RootFlow",
                    "preset_id": "rootflowai-image",
                    "base_url": "https://api.rootflowai.com/v1",
                    "models": ["gemini-2.5-flash-image"],
                    "default_model": "gemini-2.5-flash-image",
                    "api_key": "sk-test-image",
                }
            ],
            "default_provider_id": "default",
            "scenarios": {
                "tag_classification": {"provider_id": "default", "model": "gemini-2.5-flash-image"},
                "recommend_copy": {"provider_id": "default", "model": "gemini-2.5-flash-image"},
                "recommend_image": {
                    "provider_id": "default",
                    "model": "gemini-2.5-flash-image",
                },
            },
        },
    )

    with patch(
        "app.api.settings.probe_image_connection",
        new_callable=AsyncMock,
    ) as mock_test:
        res = await client.post(
            "/settings/ai/test?scenario_id=recommend_image",
        )

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["sample"] == "image_ok"
    mock_test.assert_awaited_once()

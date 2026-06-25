"""recommend_image 生图服务测试。"""

from __future__ import annotations

import base64
from unittest.mock import AsyncMock, patch

import pytest

from app.services.recommend_image import ImageProviderError, generate_image_bytes, probe_image_connection
from tests.conftest import make_test_cover_png


@pytest.mark.asyncio
async def test_generate_image_bytes_parses_b64() -> None:
    png = make_test_cover_png()
    b64 = base64.b64encode(png).decode("ascii")
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.text = ""
    mock_resp.json = lambda: {"data": [{"b64_json": b64}]}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.recommend_image.httpx.AsyncClient", return_value=mock_client):
        result = await generate_image_bytes(
            base_url="https://api.example.com/v1",
            api_key="sk-test",
            model="gemini-3.1-flash-image-count",
            prompt="test poster",
            size_preset_id="xiaohongshu-34",
        )

    assert result.startswith(b"\x89PNG")
    call_kwargs = mock_client.post.call_args.kwargs
    body = call_kwargs["json"]
    assert body["size"] == "3:4"
    assert "aspect_ratio" not in body
    assert "response_format" not in body
    assert "quality" not in body


@pytest.mark.asyncio
async def test_generate_image_bytes_downloads_url() -> None:
    png = make_test_cover_png()
    gen_resp = AsyncMock()
    gen_resp.status_code = 200
    gen_resp.text = ""
    gen_resp.json = lambda: {"data": [{"url": "https://cdn.example.com/out.png"}]}

    get_resp = AsyncMock()
    get_resp.status_code = 200
    get_resp.content = png

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=gen_resp)
    mock_client.get = AsyncMock(return_value=get_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.recommend_image.httpx.AsyncClient", return_value=mock_client):
        result = await generate_image_bytes(
            base_url="https://api.rootflowai.com/v1",
            api_key="sk-test",
            model="gemini-3.1-flash-image-count",
            prompt="test poster",
        )

    assert result == png
    mock_client.get.assert_awaited_once_with("https://cdn.example.com/out.png")


@pytest.mark.asyncio
async def test_generate_image_bytes_gpt_model_includes_quality() -> None:
    png = make_test_cover_png()
    b64 = base64.b64encode(png).decode("ascii")
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.text = ""
    mock_resp.json = lambda: {"data": [{"b64_json": b64}]}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.recommend_image.httpx.AsyncClient", return_value=mock_client):
        await generate_image_bytes(
            base_url="https://api.rootflowai.com/v1",
            api_key="sk-test",
            model="gpt-image-2-count",
            prompt="test",
        )

    body = mock_client.post.call_args.kwargs["json"]
    assert body["quality"] == "high"


@pytest.mark.asyncio
async def test_generate_image_bytes_requires_key() -> None:
    with pytest.raises(ImageProviderError, match="API Key"):
        await generate_image_bytes(
            base_url="https://api.example.com/v1",
            api_key="",
            model="gemini-3.1-flash-image-count",
            prompt="test",
        )


@pytest.mark.asyncio
async def test_probe_image_connection_delegates() -> None:
    with patch(
        "app.services.recommend_image.generate_image_bytes",
        new_callable=AsyncMock,
    ) as mock_gen:
        await probe_image_connection(
            base_url="https://api.example.com/v1",
            api_key="sk-test",
            model="gemini-3.1-flash-image-count",
        )
        mock_gen.assert_awaited_once()

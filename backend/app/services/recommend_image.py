"""内容工厂 — recommend_image 场景：OpenAI 兼容 images/generations。"""

from __future__ import annotations

import base64
import binascii
import json
from typing import Any

import httpx

from app.services.cover_size_presets import size_for_preset
from app.services.llm.provider import LlmError

# RootFlowAI 生图可能 30–150s；见 https://rootflowai.com/docs/guide/image-generation
_DEFAULT_TIMEOUT = httpx.Timeout(900.0, connect=30.0)

_IMAGE_TEST_PROMPT = (
    "Minimal 3:4 vertical promo poster test, dark background, "
    "single word TEST in clear sans-serif, no watermark."
)


class ImageProviderError(LlmError):
    """生图 Provider 错误。"""


def _images_url(base_url: str) -> str:
    return f"{base_url.rstrip('/')}/images/generations"


def _is_gpt_image_model(model: str) -> bool:
    return "gpt-image" in model.lower()


def _build_request_body(
    *,
    model: str,
    prompt: str,
    size: str,
) -> dict[str, Any]:
    """按 RootFlowAI 图像 API 构造请求体（size 比例/像素，默认返回 url）。"""
    body: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": size,
    }
    if _is_gpt_image_model(model):
        body["quality"] = "high"
    return body


async def _download_image_url(client: httpx.AsyncClient, url: str) -> bytes:
    try:
        resp = await client.get(url)
    except httpx.HTTPError as err:
        raise ImageProviderError(f"下载生图 URL 失败：{err}") from err
    if resp.status_code >= 400:
        raise ImageProviderError(f"下载生图 URL 失败（HTTP {resp.status_code}）。")
    content = resp.content
    if not content:
        raise ImageProviderError("生图 URL 返回空内容。")
    return content


def _extract_image_bytes(data: dict[str, Any], raw_item: dict[str, Any]) -> tuple[str | None, str | None]:
    """返回 (b64_json, url) 二选一。"""
    b64 = raw_item.get("b64_json")
    if isinstance(b64, str) and b64.strip():
        return b64.strip(), None
    url = raw_item.get("url")
    if isinstance(url, str) and url.strip():
        return None, url.strip()
    return None, None


async def generate_image_bytes(
    *,
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    size_preset_id: str | None = None,
    negative_prompt: str | None = None,
) -> bytes:
    if not api_key.strip():
        raise ImageProviderError("未配置生图 API Key，请在设置 → AI → 推荐配图中配置。")

    size = size_for_preset(size_preset_id)
    full_prompt = prompt.strip()
    if negative_prompt and negative_prompt.strip():
        full_prompt = f"{full_prompt}\n\nAvoid: {negative_prompt.strip()}"

    body = _build_request_body(model=model, prompt=full_prompt, size=size)

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    url = _images_url(base_url)

    try:
        async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT, follow_redirects=True) as client:
            resp = await client.post(url, json=body, headers=headers)
            if resp.status_code == 401:
                raise ImageProviderError("生图鉴权失败，请检查 API Key。")
            if resp.status_code >= 400:
                detail = resp.text[:800] if resp.text else resp.reason_phrase
                raise ImageProviderError(
                    f"生图请求失败（HTTP {resp.status_code}）：{detail}"
                )

            try:
                data = resp.json()
            except json.JSONDecodeError as err:
                raise ImageProviderError("生图响应不是有效 JSON。") from err

            items = data.get("data")
            if not isinstance(items, list) or not items:
                raise ImageProviderError("生图响应缺少 data。")
            first = items[0]
            if not isinstance(first, dict):
                raise ImageProviderError("生图响应 data[0] 无效。")

            b64, image_url = _extract_image_bytes(data, first)
            if b64:
                try:
                    return base64.b64decode(b64)
                except (ValueError, binascii.Error) as err:
                    raise ImageProviderError("生图返回的 base64 无效。") from err
            if image_url:
                return await _download_image_url(client, image_url)

            raise ImageProviderError(
                "生图响应缺少 url 或 b64_json；请确认模型名与令牌分组（GPT绘图计次 / Gemini绘图计次）匹配。"
            )
    except ImageProviderError:
        raise
    except httpx.HTTPError as err:
        raise ImageProviderError(f"生图网络错误：{err}") from err


async def probe_image_connection(
    *,
    base_url: str,
    api_key: str,
    model: str,
) -> None:
    """最小生图探测；成功则返回，失败抛 ImageProviderError。"""
    await generate_image_bytes(
        base_url=base_url,
        api_key=api_key,
        model=model,
        prompt=_IMAGE_TEST_PROMPT,
        size_preset_id="xiaohongshu-34",
    )

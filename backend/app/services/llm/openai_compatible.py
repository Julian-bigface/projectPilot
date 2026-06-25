from __future__ import annotations

import base64
import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.services.llm.provider import LlmError

_DEFAULT_TIMEOUT = httpx.Timeout(120.0, connect=15.0)


def _minimax_json_extra_body(model: str) -> dict[str, Any] | None:
    if "minimax" not in model.lower():
        return None
    return {"thinking": {"type": "disabled"}}


class OpenAiCompatibleProvider:
    """OpenAI 兼容 POST /chat/completions（含 Ollama、DeepSeek 等）。"""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model

    def _build_messages(
        self,
        *,
        system: str,
        user: str,
        user_images: list[tuple[bytes, str]] | None,
    ) -> list[dict[str, Any]]:
        if user_images:
            user_content: list[dict[str, Any]] = [{"type": "text", "text": user}]
            for img_bytes, mime in user_images:
                encoded = base64.b64encode(img_bytes).decode("ascii")
                user_content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{encoded}"},
                    }
                )
            user_message: dict[str, Any] = {"role": "user", "content": user_content}
        else:
            user_message = {"role": "user", "content": user}
        return [
            {"role": "system", "content": system},
            user_message,
        ]

    def _build_body(
        self,
        *,
        system: str,
        user: str,
        temperature: float,
        max_tokens: int,
        json_mode: bool,
        user_images: list[tuple[bytes, str]] | None,
        stream: bool,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": self._model,
            "messages": self._build_messages(system=system, user=user, user_images=user_images),
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        if json_mode and not stream:
            body["response_format"] = {"type": "json_object"}
        extra_body = _minimax_json_extra_body(self._model) if json_mode else None
        if extra_body:
            body["extra_body"] = extra_body
        return body

    @staticmethod
    def _headers(api_key: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def complete(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 4096,
        json_mode: bool = True,
        user_images: list[tuple[bytes, str]] | None = None,
    ) -> str:
        url = f"{self._base_url}/chat/completions"
        body = self._build_body(
            system=system,
            user=user,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
            user_images=user_images,
            stream=False,
        )
        headers = self._headers(self._api_key)

        async def _post(payload: dict[str, Any]) -> httpx.Response:
            try:
                async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                    return await client.post(url, json=payload, headers=headers)
            except httpx.HTTPError as err:
                raise LlmError(f"LLM 网络错误：{err}") from err

        resp = await _post(body)
        if resp.status_code >= 400 and json_mode and "response_format" in body:
            body_retry = {k: v for k, v in body.items() if k != "response_format"}
            resp = await _post(body_retry)

        if resp.status_code == 401:
            raise LlmError("LLM 鉴权失败，请检查 API Key。")
        if resp.status_code >= 400:
            detail = resp.text[:500] if resp.text else resp.reason_phrase
            raise LlmError(f"LLM 请求失败（HTTP {resp.status_code}）：{detail}")

        try:
            data = resp.json()
        except json.JSONDecodeError as err:
            raise LlmError("LLM 响应不是有效 JSON。") from err

        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            raise LlmError("LLM 响应缺少 choices。")

        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        if not isinstance(message, dict):
            raise LlmError("LLM 响应缺少 message。")

        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            reasoning = message.get("reasoning_content")
            if isinstance(reasoning, str) and reasoning.strip():
                content = reasoning
            else:
                raise LlmError("LLM 返回空内容。")

        from app.services.llm.json_extract import strip_reasoning_blocks

        return strip_reasoning_blocks(content.strip())

    async def complete_stream(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 4096,
        json_mode: bool = True,
        user_images: list[tuple[bytes, str]] | None = None,
    ) -> AsyncIterator[str]:
        url = f"{self._base_url}/chat/completions"
        body = self._build_body(
            system=system,
            user=user,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
            user_images=user_images,
            stream=True,
        )
        headers = self._headers(self._api_key)

        try:
            async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                async with client.stream("POST", url, json=body, headers=headers) as resp:
                    if resp.status_code >= 400:
                        detail = (await resp.aread()).decode("utf-8", errors="replace")[:500]
                        raise LlmError(f"LLM 请求失败（HTTP {resp.status_code}）：{detail}")
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if not payload or payload == "[DONE]":
                            continue
                        try:
                            chunk = json.loads(payload)
                        except json.JSONDecodeError:
                            continue
                        choices = chunk.get("choices")
                        if not isinstance(choices, list) or not choices:
                            continue
                        delta = choices[0].get("delta") if isinstance(choices[0], dict) else None
                        if not isinstance(delta, dict):
                            continue
                        content = delta.get("content")
                        if isinstance(content, str) and content:
                            yield content
        except httpx.HTTPError as err:
            raise LlmError(f"LLM 网络错误：{err}") from err

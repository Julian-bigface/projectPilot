from __future__ import annotations

from typing import Protocol

from collections.abc import AsyncIterator


class LlmProvider(Protocol):
    """LLM Provider 抽象（OpenAI 兼容 chat/completions）。"""

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
        """返回 assistant 文本内容。"""

    def complete_stream(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 4096,
        json_mode: bool = True,
        user_images: list[tuple[bytes, str]] | None = None,
    ) -> AsyncIterator[str]:
        """流式返回 assistant 文本增量。"""
        ...


class LlmError(Exception):
    """LLM 调用失败（网络、鉴权、Provider 错误等）。"""

from __future__ import annotations

from typing import Literal

from app.services.llm.openai_compatible import OpenAiCompatibleProvider
from app.services.llm.provider import LlmError, LlmProvider

DEFAULT_PROVIDER: Literal["openai_compatible"] = "openai_compatible"
DEFAULT_PRESET_ID = "minimax-cn"
DEFAULT_BASE_URL = "https://api.minimaxi.com/v1"
DEFAULT_MODEL = "MiniMax-M2.5-highspeed"

SUPPORTED_PROVIDERS: tuple[str, ...] = ("openai_compatible",)


def get_llm_provider(
    name: str,
    *,
    base_url: str,
    api_key: str,
    model: str,
) -> LlmProvider:
    if name == "openai_compatible":
        return OpenAiCompatibleProvider(base_url=base_url, api_key=api_key, model=model)
    raise ValueError(f"不支持的 LLM Provider: {name}")


__all__ = [
    "DEFAULT_BASE_URL",
    "DEFAULT_MODEL",
    "DEFAULT_PRESET_ID",
    "DEFAULT_PROVIDER",
    "LlmError",
    "LlmProvider",
    "SUPPORTED_PROVIDERS",
    "get_llm_provider",
]

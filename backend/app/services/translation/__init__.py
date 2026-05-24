from __future__ import annotations

import re
from typing import Literal

from app.services.translation.google_provider import GoogleTranslationProvider
from app.services.translation.provider import TranslationProvider

SUPPORTED_TARGET_LANGS: tuple[str, ...] = ("zh-CN", "zh-TW", "en", "ja", "ko")
DEFAULT_TARGET_LANG = "zh-CN"
DEFAULT_PROVIDER: Literal["google"] = "google"

_MAX_CHUNK_CHARS = 4500

_FENCE_PATTERN = re.compile(r"(```[\s\S]*?```)", re.MULTILINE)


def get_translation_provider(name: str) -> TranslationProvider:
    if name == "google":
        return GoogleTranslationProvider()
    raise ValueError(f"不支持的翻译 Provider: {name}")

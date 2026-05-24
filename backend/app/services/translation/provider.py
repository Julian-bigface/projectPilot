from __future__ import annotations

from typing import Protocol


class TranslationProvider(Protocol):
    """机器翻译 Provider 抽象。"""

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """将 text 从 source_lang 翻译为 target_lang；source_lang 可为 auto。"""


class TranslationError(Exception):
    """翻译失败（网络、限流、Provider 错误等）。"""

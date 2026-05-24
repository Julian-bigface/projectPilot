from __future__ import annotations

from deep_translator import GoogleTranslator

from app.services.translation.provider import TranslationError

# deep-translator 语言码映射（BCP-47 → Google）
_LANG_MAP = {
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
    "en": "en",
    "ja": "ja",
    "ko": "ko",
}

_AUTO_SOURCE = "auto"


def _to_google_lang(code: str) -> str:
    normalized = code.strip()
    if normalized in _LANG_MAP:
        return _LANG_MAP[normalized]
    if normalized.lower() == "auto":
        return _AUTO_SOURCE
    return normalized


class GoogleTranslationProvider:
    """非官方免费 Google 翻译通道（deep-translator）。"""

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        if not text.strip():
            return text
        src = _to_google_lang(source_lang)
        tgt = _to_google_lang(target_lang)
        try:
            translator = GoogleTranslator(source=src, target=tgt)
            result = translator.translate(text)
        except Exception as err:  # noqa: BLE001 — 第三方库异常类型不固定
            raise TranslationError(
                "翻译请求失败，可能被限流或网络不可用，请稍后重试。"
            ) from err
        if result is None:
            raise TranslationError("翻译返回为空，请稍后重试。")
        return result

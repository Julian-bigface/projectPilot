"""封面风格生成 — Vision 模型门禁。"""

from __future__ import annotations

import re

_VISION_MODEL_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"gpt-4o", re.I),
    re.compile(r"gpt-4\.1", re.I),
    re.compile(r"gpt-4-vision", re.I),
    re.compile(r"\bo[134]\b", re.I),
    re.compile(r"claude-3", re.I),
    re.compile(r"claude-sonnet-4", re.I),
    re.compile(r"claude-opus-4", re.I),
    re.compile(r"gemini", re.I),
    re.compile(r"qwen-vl", re.I),
    re.compile(r"qwen2-vl", re.I),
    re.compile(r"vision", re.I),
    re.compile(r"vl-", re.I),
    re.compile(r"minimax-vl", re.I),
    re.compile(r"MiniMax-M3", re.I),
    re.compile(r"MiniMax-VL", re.I),
)

_PRESET_VISION_MODELS: dict[str, frozenset[str]] = {
    "openai": frozenset({"gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"}),
    "rootflowai-image": frozenset(
        {
            "gemini-3.1-flash-image-count",
            "gemini-3.1-flash-image-hd-count",
            "gemini-3-pro-image-count",
            "gemini-3-pro-image-hd-count",
            "gemini-2.5-flash-image-count",
        }
    ),
    "ollama-local": frozenset({"llava", "llava:latest", "qwen2-vl", "bakllava"}),
    "minimax-cn": frozenset({"MiniMax-M3", "MiniMax-VL-01"}),
    "minimax-global": frozenset({"MiniMax-M3", "MiniMax-VL-01"}),
}


class CoverStyleVisionError(Exception):
    """当前模型不支持参考图分析。"""


def is_vision_model(model: str, *, provider_id: str = "") -> bool:
    name = (model or "").strip()
    if not name:
        return False
    preset_models = _PRESET_VISION_MODELS.get((provider_id or "").strip())
    if preset_models and name in preset_models:
        return True
    return any(pattern.search(name) for pattern in _VISION_MODEL_PATTERNS)


def assert_vision_model(model: str, *, provider_id: str = "") -> None:
    if not is_vision_model(model, provider_id=provider_id):
        raise CoverStyleVisionError(
            "上传参考图生成风格需使用支持视觉的模型。"
            "请在设置 → AI → 封面风格生成中选择支持视觉的模型（如 GPT-4o、Claude 3+、Gemini 等）。"
        )

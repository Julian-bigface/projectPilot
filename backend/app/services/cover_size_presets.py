"""内容工厂封面输出画幅预设（与前端 readme-cover-presets 对齐）。"""

from __future__ import annotations

from dataclasses import dataclass

DEFAULT_COVER_SIZE_PRESET_ID = "xiaohongshu-34"


@dataclass(frozen=True)
class CoverSizePreset:
    id: str
    label: str
    ratio: str
    width: int
    height: int


COVER_SIZE_PRESETS: tuple[CoverSizePreset, ...] = (
    CoverSizePreset("xiaohongshu-34", "小红书", "3:4", 1242, 1660),
    CoverSizePreset("square-11", "方图", "1:1", 1080, 1080),
    CoverSizePreset("vertical-916", "竖屏视频", "9:16", 1080, 1920),
    CoverSizePreset("portrait-23", "竖版", "2:3", 1000, 1500),
    CoverSizePreset("wide-169", "横屏", "16:9", 1920, 1080),
)

_PRESET_BY_ID = {p.id: p for p in COVER_SIZE_PRESETS}


def get_cover_size_preset(preset_id: str | None) -> CoverSizePreset:
    if preset_id and preset_id in _PRESET_BY_ID:
        return _PRESET_BY_ID[preset_id]
    return _PRESET_BY_ID[DEFAULT_COVER_SIZE_PRESET_ID]


def aspect_ratio_for_preset(preset_id: str | None) -> str:
    return get_cover_size_preset(preset_id).ratio


def size_for_preset(preset_id: str | None) -> str:
    """RootFlowAI 等兼容 OpenAI Images 的 size（比例或像素）。"""
    return get_cover_size_preset(preset_id).ratio


def cover_size_prompt_prefix(preset_id: str | None) -> str:
    """生成画面前缀中的画幅描述（供出图 prompt 与风格示例使用）。"""
    preset = get_cover_size_preset(preset_id)
    if preset.width > preset.height:
        shape = "horizontal landscape cover"
    elif preset.width < preset.height:
        shape = "vertical portrait cover"
    else:
        shape = "square cover"
    return f"{preset.width}x{preset.height}, {preset.ratio} {shape}, strict margins"

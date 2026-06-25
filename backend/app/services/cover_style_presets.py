"""内容工厂 — Phase 1 内置封面风格预设（手工精简 §7 五条）。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.services.cover_style_design_analysis import CoverStyleDesignAnalysis

CoverStyleSource = Literal["builtin", "manual", "ai_generated"]
FontTokenKind = Literal["sans", "serif", "mono", "display"]


class FontTokens(BaseModel):
    heading: FontTokenKind = "sans"
    body: FontTokenKind = "sans"
    accent: FontTokenKind = "mono"


class ColorTokens(BaseModel):
    background: str = "#0a0a0a"
    accent: str = "#39ff14"
    text_safe: str = "#ffffff"


class CoverStylePreset(BaseModel):
    id: str
    label: str
    source: CoverStyleSource = "builtin"
    prompt_prefix: str
    prompt_template: str
    negative_prompt: str
    color_tokens: ColorTokens = Field(default_factory=ColorTokens)
    font_tokens: FontTokens = Field(default_factory=FontTokens)
    design_analysis: CoverStyleDesignAnalysis | None = None


_BUILTIN_STYLES: tuple[CoverStylePreset, ...] = (
    CoverStylePreset(
        id="minimal-tech",
        label="极简科技",
        prompt_prefix=(
            "1242x1660, 3:4 vertical portrait cover, strict margins, "
            "minimal tech magazine aesthetic, dark neutral background, "
            "high-end product launch poster, generous whitespace for typography."
        ),
        prompt_template=(
            "主视觉：抽象几何科技造型、淡淡网格线、柔和聚光灯。"
            "项目背景：{project_name} — {project_description}。"
            "推广文案（须清晰可读）：主标题「{headline}」；副文案「{cover_texts}」。"
            "若有空间，高亮标签以小药丸形式呈现：{highlight_tags}。"
        ),
        negative_prompt=(
            "cheap gradient, cluttered layout, watermark, logo soup, "
            "misspelled text, garbled characters, blurry typography, low resolution"
        ),
        color_tokens=ColorTokens(background="#0f1419", accent="#3b82f6", text_safe="#f8fafc"),
        font_tokens=FontTokens(heading="sans", body="sans", accent="mono"),
    ),
    CoverStylePreset(
        id="black-gold",
        label="黑金商务",
        prompt_prefix=(
            "1242x1660, 3:4 vertical portrait, luxury black and gold business poster, "
            "editorial layout, premium enterprise tone, strong contrast for text."
        ),
        prompt_template=(
            "主视觉：黑色背景搭配克制金色点缀与精致边框。"
            "项目：{project_name}。"
            "主标题「{headline}」；辅助文案「{cover_texts}」。"
            "标签：{highlight_tags}。"
        ),
        negative_prompt=(
            "neon colors, cartoon, cheap glitter, garbled text, watermark, busy collage"
        ),
        color_tokens=ColorTokens(background="#0a0a0a", accent="#d4af37", text_safe="#fafafa"),
        font_tokens=FontTokens(heading="serif", body="sans", accent="display"),
    ),
    CoverStylePreset(
        id="code-style",
        label="代码风格",
        prompt_prefix=(
            "1242x1660, 3:4 vertical, cyber archive hacker dossier style, "
            "terminal-inspired but polished, monospace accent areas."
        ),
        prompt_template=(
            "主视觉：代码片段纹理、矩阵感细线、开发者工具气质。"
            "项目：{project_name}（{project_language}）。"
            "主标题「{headline}」；要点「{cover_texts}」。"
            "标签：{highlight_tags}。"
        ),
        negative_prompt=(
            "illegible tiny code, rainbow gradient, garbled text, meme style, watermark"
        ),
        color_tokens=ColorTokens(background="#0d1117", accent="#3fb950", text_safe="#e6edf3"),
        font_tokens=FontTokens(heading="mono", body="mono", accent="mono"),
    ),
    CoverStylePreset(
        id="gradient",
        label="渐变炫彩",
        prompt_prefix=(
            "1242x1660, 3:4 vertical, refined aurora glass aesthetic, "
            "controlled color transitions, still premium not tacky."
        ),
        prompt_template=(
            "主视觉：柔和极光光晕、玻璃拟态面板、现代 SaaS 推广感。"
            "项目：{project_name}。"
            "主标题「{headline}」；副文案「{cover_texts}」。"
            "标签：{highlight_tags}。"
        ),
        negative_prompt=(
            "cheap purple-blue cliché, oversaturated, garbled text, clipart, watermark, "
            "1990s powerpoint"
        ),
        color_tokens=ColorTokens(background="#1e1b4b", accent="#a855f7", text_safe="#ffffff"),
        font_tokens=FontTokens(heading="sans", body="sans", accent="display"),
    ),
    CoverStylePreset(
        id="geek",
        label="极客风",
        prompt_prefix=(
            "1242x1660, 3:4 vertical, future lab dashboard UI poster, "
            "product screenshot mood, clean HUD elements."
        ),
        prompt_template=(
            "主视觉：未来感 UI 面板、数据可视化暗示、开源产品英雄图。"
            "项目：{project_name}，Star 数 {project_stars}。"
            "主标题「{headline}」；特性「{cover_texts}」。"
            "标签：{highlight_tags}。"
        ),
        negative_prompt=(
            "messy dashboard, garbled text, stock photo people, watermark, low contrast text"
        ),
        color_tokens=ColorTokens(background="#0f172a", accent="#22d3ee", text_safe="#f1f5f9"),
        font_tokens=FontTokens(heading="sans", body="sans", accent="mono"),
    ),
)

_STYLE_BY_ID = {s.id: s for s in _BUILTIN_STYLES}


def list_builtin_styles() -> list[CoverStylePreset]:
    return list(_BUILTIN_STYLES)


def get_builtin_style(style_id: str) -> CoverStylePreset | None:
    return _STYLE_BY_ID.get(style_id)


def is_builtin_style_id(style_id: str) -> bool:
    return style_id in _STYLE_BY_ID

"""内容工厂 — AI 封面 image_prompt 拼装。"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass

from app.models.project import Project
from app.services.cover_size_presets import cover_size_prompt_prefix
from app.services.cover_style_design_analysis import format_design_analysis_for_image_prompt
from app.services.cover_style_presets import CoverStylePreset, get_builtin_style

_COVER_PROMPT_TEMPLATE_VAR_NAMES = frozenset(
    {
        "project_name",
        "project_description",
        "project_language",
        "project_stars",
        "headline",
        "cover_texts",
        "highlight_tags",
    }
)
_BRACE_PLACEHOLDER_RE = re.compile(r"\{([^{}]+)\}")
_SIZE_DIMENSION_RE = re.compile(r"\b\d{3,4}x\d{3,4}\b", re.I)
_SIZE_RATIO_RE = re.compile(r"\b\d+:\d+\b")
_ORIENTATION_PHRASES = (
    "vertical portrait cover",
    "horizontal landscape cover",
    "square cover",
    "portrait cover",
    "landscape cover",
)


class CoverPromptError(Exception):
    """风格或输入无效。"""


def sanitize_prompt_template_braces(template: str) -> str:
    """将非占位符的 {…} 解包为纯文本，避免 str.format KeyError。"""

    def _repl(match: re.Match[str]) -> str:
        inner = match.group(1).strip()
        if inner in _COVER_PROMPT_TEMPLATE_VAR_NAMES:
            return match.group(0)
        return inner

    return _BRACE_PLACEHOLDER_RE.sub(_repl, template)


def render_cover_prompt_template(template: str, template_vars: dict[str, str]) -> str:
    sanitized = sanitize_prompt_template_braces(template)
    try:
        return sanitized.format(**template_vars)
    except KeyError as err:
        raise CoverPromptError(f"风格模板占位符错误：{err}") from err


def _looks_like_size_clause(clause: str) -> bool:
    return bool(_SIZE_DIMENSION_RE.search(clause)) or bool(_SIZE_RATIO_RE.search(clause))


def _strip_size_tokens(text: str) -> str:
    result = text
    result = _SIZE_DIMENSION_RE.sub(" ", result)
    result = _SIZE_RATIO_RE.sub(" ", result)
    for phrase in _ORIENTATION_PHRASES:
        result = re.sub(re.escape(phrase), " ", result, flags=re.I)
    result = re.sub(r"\bstrict margins\b", " ", result, flags=re.I)
    result = re.sub(r"\s+", " ", result).strip()
    result = re.sub(r"^[,，；;\s]+", "", result)
    result = re.sub(r"[,，；;\s]+$", "", result)
    return result


def apply_size_preset_to_prompt_prefix(prefix: str, size_preset_id: str) -> str:
    """用所选画幅替换风格里 baked-in 的 1242x1660 / 3:4 等描述，保留气质段落。"""
    size_line = cover_size_prompt_prefix(size_preset_id)
    text = prefix.strip()
    if not text:
        return size_line

    parts = re.split(r"[；;]", text, maxsplit=1)
    if len(parts) == 2:
        first, rest = parts[0].strip(), parts[1].strip()
        if _looks_like_size_clause(first):
            return f"{size_line}；{rest}" if rest else size_line

    rest = _strip_size_tokens(text)
    return f"{size_line}, {rest}" if rest else size_line


@dataclass(frozen=True)
class BuiltCoverPrompt:
    image_prompt: str
    negative_prompt: str
    prompt_hash: str
    style: CoverStylePreset


def _font_hint(style: CoverStylePreset) -> str:
    ft = style.font_tokens
    return (
        f"Typography mood: heading={ft.heading}, body={ft.body}, accent={ft.accent}. "
        f"Palette: background {style.color_tokens.background}, "
        f"accent {style.color_tokens.accent}."
    )


def _pick_headline(body_json: dict) -> str:
    hook = body_json.get("hook")
    if isinstance(hook, str) and hook.strip():
        return hook.strip()
    titles = body_json.get("title_options")
    if isinstance(titles, list):
        for item in titles:
            if isinstance(item, str) and item.strip():
                return item.strip()
    return ""


def _pick_cover_texts(body_json: dict) -> str:
    texts = body_json.get("cover_texts")
    if not isinstance(texts, list):
        return ""
    parts = [str(t).strip() for t in texts if isinstance(t, str) and str(t).strip()]
    return " · ".join(parts[:3])


def _pick_highlight_tags(body_json: dict) -> str:
    tags = body_json.get("highlight_tags")
    if not isinstance(tags, list):
        return ""
    parts = [str(t).strip() for t in tags if isinstance(t, str) and str(t).strip()]
    return ", ".join(parts[:4])


def build_cover_prompt(
    *,
    style_id: str,
    project: Project,
    body_json: dict | None,
    style: CoverStylePreset | None = None,
    size_preset_id: str | None = None,
) -> BuiltCoverPrompt:
    resolved = style or get_builtin_style(style_id)
    if resolved is None:
        raise CoverPromptError(f"未知封面风格：{style_id}")
    style = resolved

    bj = body_json or {}
    headline = _pick_headline(bj) or project.name
    cover_texts = _pick_cover_texts(bj)
    highlight_tags = _pick_highlight_tags(bj)
    description = (project.description or project.name or "").strip()

    template_vars = {
        "project_name": project.name,
        "project_description": description[:200],
        "project_language": project.language or "unknown",
        "project_stars": str(project.stars or 0),
        "headline": headline,
        "cover_texts": cover_texts or headline,
        "highlight_tags": highlight_tags or "open source",
    }

    try:
        body_part = render_cover_prompt_template(style.prompt_template, template_vars)
    except CoverPromptError:
        raise

    prompt_prefix = style.prompt_prefix
    if size_preset_id:
        prompt_prefix = apply_size_preset_to_prompt_prefix(prompt_prefix, size_preset_id)

    image_prompt = (
        f"{prompt_prefix}\n"
        f"{_font_hint(style)}\n"
        f"{format_design_analysis_for_image_prompt(style.design_analysis)}\n"
        f"{body_part}"
    ).replace("\n\n\n", "\n\n").strip()
    negative_prompt = style.negative_prompt.strip()

    hash_payload = {
        "style_id": style_id,
        "size_preset_id": size_preset_id,
        "image_prompt": image_prompt,
        "negative_prompt": negative_prompt,
    }
    prompt_hash = hashlib.sha256(
        json.dumps(hash_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]

    return BuiltCoverPrompt(
        image_prompt=image_prompt,
        negative_prompt=negative_prompt,
        prompt_hash=prompt_hash,
        style=style,
    )

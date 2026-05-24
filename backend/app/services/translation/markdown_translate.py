from __future__ import annotations

import re

from app.services.translation import _MAX_CHUNK_CHARS, _FENCE_PATTERN
from app.services.translation.provider import TranslationError, TranslationProvider

# 行内 code、Markdown 链接、HTML 注释、HTML 标签：整段保留，不送入 MT
# 链接须在内联 code 之前匹配，避免 [`/cmd`](url) 被拆成 `- [` + code + `](url)` 导致 Google 返回空
_PRESERVE_TOKEN = re.compile(
    r"(!?\[[^\]]+\]\([^)]*\))"
    r"|(`[^`\n]+`)"
    r"|(<!--[\s\S]*?-->)"
    r"|(<[^>]+>)"
)

_HTML_FENCE_LANGS = frozenset({"", "html", "xml"})
_HTML_MARKUP_HINT = re.compile(
    r"<\s*(?:a|div|p|h[1-6]|img|span|center|table|section|header|footer|nav|ul|ol|li|br|hr)\b",
    re.IGNORECASE,
)


def _extract_fenced_inner(segment: str) -> tuple[str, str] | None:
    """解析 fenced block，返回 (lang, inner)；格式非法时返回 None。"""
    stripped = segment.strip()
    if not stripped.startswith("```"):
        return None
    lines = stripped.split("\n")
    if len(lines) < 2 or lines[-1].strip() != "```":
        return None
    lang = lines[0].strip()[3:].strip().lower()
    inner = "\n".join(lines[1:-1])
    return lang, inner


def _is_html_markup_block(inner: str) -> bool:
    """是否为 README 常见的展示用 HTML（链接/图片/居中布局等）。"""
    s = inner.strip()
    if not s.startswith("<"):
        return False
    return _HTML_MARKUP_HINT.search(s) is not None


def _unwrap_html_fence(segment: str) -> str | None:
    """若 segment 为 ```html 类展示 HTML，返回 inner；否则 None。"""
    parsed = _extract_fenced_inner(segment)
    if parsed is None:
        return None
    lang, inner = parsed
    if lang not in _HTML_FENCE_LANGS:
        return None
    if not _is_html_markup_block(inner):
        return None
    return inner


def _iter_translatable_runs(text: str):
    """按保留 token 切分；(片段, 是否可翻译)。"""
    last_end = 0
    for match in _PRESERVE_TOKEN.finditer(text):
        if match.start() > last_end:
            yield text[last_end : match.start()], True
        yield match.group(0), False
        last_end = match.end()
    if last_end < len(text):
        yield text[last_end:], True


def split_markdown_segments(content: str) -> list[tuple[str, bool]]:
    """按 fenced code block 切分；返回 (segment, is_code) 列表。"""
    if not content:
        return []
    parts = _FENCE_PATTERN.split(content)
    segments: list[tuple[str, bool]] = []
    for part in parts:
        if not part:
            continue
        is_code = part.startswith("```")
        segments.append((part, is_code))
    if not segments and content:
        segments.append((content, False))
    return segments


def list_markdown_display_blocks(content: str) -> list[str]:
    """将 Markdown 切分为适合逐块翻译/渲染的段落（代码块整段保留）。"""
    if not content.strip():
        return []
    blocks: list[str] = []
    for segment, is_code in split_markdown_segments(content):
        if is_code:
            html_inner = _unwrap_html_fence(segment)
            blocks.append(html_inner if html_inner is not None else segment)
            continue
        for part in re.split(r"\n\n+", segment):
            if part.strip():
                blocks.append(part)
    return blocks


def join_markdown_display_blocks(blocks: list[str]) -> str:
    return "\n\n".join(blocks)


def block_needs_translation(block: str) -> bool:
    """代码围栏块无需送入 MT；展示 HTML 与普通段落需要。"""
    stripped = block.strip()
    if not stripped:
        return False
    if stripped.startswith("```") and _unwrap_html_fence(block) is None:
        return False
    return True


def translate_markdown_block(
    provider: TranslationProvider,
    block: str,
    source_lang: str,
    target_lang: str,
) -> str:
    """翻译单个 Markdown 块，规则与 translate_markdown 一致。"""
    if not block.strip():
        return block
    if not block_needs_translation(block):
        return block
    if block.strip().startswith("```"):
        html_inner = _unwrap_html_fence(block)
        if html_inner is not None:
            return _translate_text_chunks(provider, html_inner, source_lang, target_lang)
        return block
    return _translate_text_chunks(provider, block, source_lang, target_lang)


def _split_long_text(text: str, max_chars: int = _MAX_CHUNK_CHARS) -> list[str]:
    if len(text) <= max_chars:
        return [text] if text else []
    chunks: list[str] = []
    remaining = text
    while remaining:
        if len(remaining) <= max_chars:
            chunks.append(remaining)
            break
        window = remaining[:max_chars]
        split_at = window.rfind("\n\n")
        if split_at < max_chars // 2:
            split_at = max_chars
        chunk = remaining[:split_at]
        chunks.append(chunk)
        remaining = remaining[split_at:]
    return chunks


def _should_skip_mt_fragment(text: str) -> bool:
    """过短或仅含 Markdown 标点的前缀/后缀不送入 MT（Google 对 `- ` 等会返回空）。"""
    stripped = text.strip()
    if not stripped:
        return True
    if re.fullmatch(r"[-*+>#_\s]+", stripped):
        return True
    return len(stripped) <= 1


def _translate_plain_run(
    provider: TranslationProvider,
    text: str,
    source_lang: str,
    target_lang: str,
) -> str:
    if not text.strip():
        return text
    if _should_skip_mt_fragment(text):
        return text
    chunks = _split_long_text(text)
    translated_parts: list[str] = []
    for chunk in chunks:
        if not chunk.strip() or _should_skip_mt_fragment(chunk):
            translated_parts.append(chunk)
            continue
        translated_parts.append(provider.translate(chunk, source_lang, target_lang))
    return "".join(translated_parts)


def _translate_text_chunks(
    provider: TranslationProvider,
    text: str,
    source_lang: str,
    target_lang: str,
) -> str:
    if not text.strip():
        return text
    out: list[str] = []
    for piece, translatable in _iter_translatable_runs(text):
        if translatable:
            out.append(_translate_plain_run(provider, piece, source_lang, target_lang))
        else:
            out.append(piece)
    return "".join(out)


def translate_markdown(
    provider: TranslationProvider,
    content: str,
    source_lang: str,
    target_lang: str,
) -> str:
    """翻译 Markdown：代码块原样保留，HTML/行内 code 不送入 MT，仅翻译可见文本。"""
    if not content.strip():
        raise TranslationError("没有可翻译的内容。")
    segments = split_markdown_segments(content)
    if not segments:
        raise TranslationError("没有可翻译的内容。")
    out: list[str] = []
    for segment, is_code in segments:
        if is_code:
            html_inner = _unwrap_html_fence(segment)
            if html_inner is not None:
                out.append(
                    _translate_text_chunks(provider, html_inner, source_lang, target_lang)
                )
            else:
                out.append(segment)
        else:
            out.append(_translate_text_chunks(provider, segment, source_lang, target_lang))
    return "".join(out)


def translate_plain_text(
    provider: TranslationProvider,
    text: str,
    source_lang: str,
    target_lang: str,
) -> str:
    if not text or not text.strip():
        raise TranslationError("简介为空，无法翻译。")
    return _translate_text_chunks(provider, text, source_lang, target_lang)

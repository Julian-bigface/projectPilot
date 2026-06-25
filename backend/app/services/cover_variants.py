"""内容工厂 — 封面 variant 索引（风格 + 画幅 → 本地 PNG 路径）。"""

from __future__ import annotations

import re
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any, Literal

CoverSourceKind = Literal["readme_capture", "ai_generated"]

_VARIANT_KEY_SEP = "::"
_DEFAULT_SIZE_PRESET_ID = "xiaohongshu-34"
_SLUG_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def cover_variant_key(style_id: str, size_preset_id: str | None) -> str:
    style = (style_id or "native-readme").strip() or "native-readme"
    size = (size_preset_id or _DEFAULT_SIZE_PRESET_ID).strip() or _DEFAULT_SIZE_PRESET_ID
    return f"{style}{_VARIANT_KEY_SEP}{size}"


def slugify_cover_filename_part(value: str, *, max_len: int = 48) -> str:
    text = (value or "cover").strip().replace(" ", "-")
    text = _SLUG_RE.sub("-", text).strip("-._")
    if not text:
        text = "cover"
    return text[:max_len]


def cover_variant_record(
    *,
    cover_image_path: str,
    cover_source: CoverSourceKind,
    style_id: str,
    size_preset_id: str,
    cover_prompt_hash: str | None = None,
    cover_readme_sha: str | None = None,
    cover_generated_at: str | None = None,
) -> dict[str, Any]:
    return {
        "cover_image_path": cover_image_path,
        "cover_source": cover_source,
        "cover_style_id": style_id,
        "cover_size_preset_id": size_preset_id,
        "cover_prompt_hash": cover_prompt_hash,
        "cover_readme_sha": cover_readme_sha,
        "cover_generated_at": cover_generated_at or datetime.now(UTC).isoformat(),
    }


def get_cover_variants(body_json: dict | None) -> dict[str, dict[str, Any]]:
    raw = (body_json or {}).get("cover_variants")
    if not isinstance(raw, dict):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for key, value in raw.items():
        if isinstance(key, str) and isinstance(value, dict):
            path = value.get("cover_image_path")
            if isinstance(path, str) and path.strip():
                out[key] = value
    return out


def get_cover_variant(
    body_json: dict | None,
    *,
    style_id: str,
    size_preset_id: str | None,
) -> dict[str, Any] | None:
    variants = get_cover_variants(body_json)
    key = cover_variant_key(style_id, size_preset_id)
    record = variants.get(key)
    if record is not None:
        return record
    return _legacy_variant_fallback(body_json, style_id=style_id, size_preset_id=size_preset_id)


def _legacy_variant_fallback(
    body_json: dict | None,
    *,
    style_id: str,
    size_preset_id: str | None,
) -> dict[str, Any] | None:
    """旧草稿仅有一个 cover_image_path 时的兼容读取。"""
    if not body_json:
        return None
    path = body_json.get("cover_image_path")
    if not isinstance(path, str) or not path.strip():
        return None
    stored_style = body_json.get("cover_style_id") or body_json.get("image_template")
    stored_size = body_json.get("cover_size_preset_id") or _DEFAULT_SIZE_PRESET_ID
    source = body_json.get("cover_source")
    if style_id == "native-readme":
        if source == "ai_generated":
            return None
        if stored_style not in (None, "native-readme") and source != "readme_capture":
            return None
    else:
        if source != "ai_generated":
            return None
        if stored_style and stored_style != style_id:
            return None
    if stored_size != (size_preset_id or _DEFAULT_SIZE_PRESET_ID):
        return None
    return {
        "cover_image_path": path,
        "cover_source": source or ("readme_capture" if style_id == "native-readme" else "ai_generated"),
        "cover_style_id": stored_style or style_id,
        "cover_size_preset_id": stored_size,
        "cover_prompt_hash": body_json.get("cover_prompt_hash"),
        "cover_readme_sha": body_json.get("cover_readme_sha"),
        "cover_generated_at": body_json.get("cover_generated_at"),
    }


def upsert_cover_variant(
    body_json: dict | None,
    *,
    style_id: str,
    size_preset_id: str,
    record: dict[str, Any],
) -> dict:
    merged = deepcopy(body_json or {})
    variants = get_cover_variants(merged)
    variants[cover_variant_key(style_id, size_preset_id)] = record
    merged["cover_variants"] = variants
    merged["image_template"] = style_id
    merged["cover_image_path"] = record["cover_image_path"]
    merged["cover_source"] = record["cover_source"]
    merged["cover_style_id"] = record.get("cover_style_id", style_id)
    merged["cover_size_preset_id"] = size_preset_id
    merged["cover_generated_at"] = record.get("cover_generated_at")
    if record.get("cover_prompt_hash"):
        merged["cover_prompt_hash"] = record["cover_prompt_hash"]
    if record.get("cover_readme_sha"):
        merged["cover_readme_sha"] = record["cover_readme_sha"]
    return merged


def merge_body_json_cover_variants(existing: dict | None, incoming: dict) -> dict:
    """PATCH 时合并 cover_variants，避免前端 stale patch 覆盖新生成的 variant。"""
    merged = deepcopy(incoming)
    old_variants = get_cover_variants(existing)
    new_variants = get_cover_variants(incoming)
    if old_variants or new_variants:
        combined = deepcopy(old_variants)
        combined.update(new_variants)
        merged["cover_variants"] = combined
    return merged


def resolve_cover_path_for_request(
    body_json: dict | None,
    *,
    style_id: str | None,
    size_preset_id: str | None,
    library_id: int | None = None,
    draft_id: int | None = None,
) -> str | None:
    style = style_id
    size = size_preset_id
    if not style:
        raw_style = (body_json or {}).get("image_template")
        style = raw_style if isinstance(raw_style, str) and raw_style.strip() else "native-readme"
    if not size:
        raw_size = (body_json or {}).get("cover_size_preset_id")
        size = raw_size if isinstance(raw_size, str) and raw_size.strip() else _DEFAULT_SIZE_PRESET_ID
    variant = get_cover_variant(body_json, style_id=style, size_preset_id=size)
    if variant:
        path = variant.get("cover_image_path")
        if isinstance(path, str) and path.strip():
            absolute = _cover_file_if_exists(path.strip())
            if absolute:
                return path.strip()
    if style != "native-readme" and library_id is not None and draft_id is not None:
        from app.services.readme_cover_storage import find_newest_draft_cover_file

        disk_path = find_newest_draft_cover_file(
            library_id=library_id,
            draft_id=draft_id,
            style_id=style,
            size_preset_id=size,
        )
        if disk_path:
            return disk_path
    return None


def _cover_file_if_exists(relative_path: str) -> bool:
    from app.services.readme_cover_storage import cover_absolute_path

    absolute = cover_absolute_path(relative_path)
    return absolute.is_file() and absolute.stat().st_size > 0

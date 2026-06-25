"""内容工厂 — README / AI 封面 PNG 本地存储。"""

from __future__ import annotations

import secrets
import struct
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import settings
from app.services.cover_size_presets import get_cover_size_preset
from app.services.cover_variants import slugify_cover_filename_part

_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_MAX_COVER_BYTES = 10 * 1024 * 1024
_MIN_COVER_WIDTH = 600
_MIN_COVER_HEIGHT = 400


class ReadmeCoverError(Exception):
    """封面保存失败（API 层映射为 400/424）。"""


def cover_absolute_path(relative_path: str) -> Path:
    return Path(settings.content_factory_assets_dir) / relative_path


def cover_api_path(*, library_id: int, draft_id: int) -> str:
    return (
        f"/api/project-libraries/{library_id}/content-factory/drafts/{draft_id}/cover"
    )


def cover_generated_at_iso() -> str:
    return datetime.now(UTC).isoformat()


def build_cover_filename(
    *,
    project_name: str,
    style_id: str,
    size_preset_id: str,
    unique_suffix: str,
) -> str:
    """文件名：{项目}_{风格}_{比例}_{后缀}.png"""
    slug_name = slugify_cover_filename_part(project_name)
    slug_style = slugify_cover_filename_part(style_id)
    ratio = get_cover_size_preset(size_preset_id).ratio.replace(":", "x")
    slug_suffix = slugify_cover_filename_part(unique_suffix, max_len=32)
    return f"{slug_name}_{slug_style}_{ratio}_{slug_suffix}.png"


def cover_relative_path(
    *,
    library_id: int,
    draft_id: int,
    project_name: str,
    style_id: str,
    size_preset_id: str,
    unique_suffix: str,
) -> str:
    filename = build_cover_filename(
        project_name=project_name,
        style_id=style_id,
        size_preset_id=size_preset_id,
        unique_suffix=unique_suffix,
    )
    return f"{library_id}/{draft_id}/{filename}"


def find_newest_draft_cover_file(
    *,
    library_id: int,
    draft_id: int,
    style_id: str,
    size_preset_id: str,
) -> str | None:
    """在草稿目录中按 风格+画幅 查找最新 PNG（修复 variant 未登记时的孤儿文件）。"""
    directory = cover_absolute_path(f"{library_id}/{draft_id}")
    if not directory.is_dir():
        return None
    style_slug = slugify_cover_filename_part(style_id)
    ratio = get_cover_size_preset(size_preset_id).ratio.replace(":", "x")
    pattern = f"*_{style_slug}_{ratio}_*.png"
    matches = sorted(directory.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    for path in matches:
        if path.is_file() and path.stat().st_size > 0:
            return f"{library_id}/{draft_id}/{path.name}"
    return None


def _png_dimensions(file_bytes: bytes) -> tuple[int, int] | None:
    if len(file_bytes) < 24:
        return None
    if file_bytes[12:16] != b"IHDR":
        return None
    width, height = struct.unpack(">II", file_bytes[16:24])
    return width, height


def validate_cover_png(file_bytes: bytes) -> None:
    if not file_bytes:
        raise ReadmeCoverError("封面文件为空。")
    if len(file_bytes) > _MAX_COVER_BYTES:
        raise ReadmeCoverError("封面文件过大（上限 10MB）。")
    if not file_bytes.startswith(_PNG_MAGIC):
        raise ReadmeCoverError("封面须为 PNG 格式。")
    dims = _png_dimensions(file_bytes)
    if dims is None:
        raise ReadmeCoverError("封面 PNG 结构无效。")
    width, height = dims
    if width < _MIN_COVER_WIDTH or height < _MIN_COVER_HEIGHT:
        raise ReadmeCoverError(
            f"封面尺寸过小（至少 {_MIN_COVER_WIDTH}×{_MIN_COVER_HEIGHT}）。"
        )


def _write_cover_file(relative: str, file_bytes: bytes, *, force: bool) -> None:
    absolute = cover_absolute_path(relative)
    if absolute.is_file() and not force:
        return
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_bytes(file_bytes)


def save_cover_png(
    file_bytes: bytes,
    *,
    library_id: int,
    draft_id: int,
    project_name: str,
    style_id: str = "native-readme",
    size_preset_id: str,
    readme_sha: str,
    force: bool = False,
    existing_readme_sha: str | None = None,
    existing_cover_path: str | None = None,
) -> tuple[str, bool]:
    """保存 README 截图封面；force 时写入新时间戳文件，不覆盖历史。"""
    validate_cover_png(file_bytes)
    sha = (readme_sha or "unknown").strip() or "unknown"

    if (
        not force
        and existing_readme_sha == sha
        and existing_cover_path
    ):
        existing_absolute = cover_absolute_path(existing_cover_path)
        if existing_absolute.is_file() and existing_absolute.stat().st_size > 0:
            return existing_cover_path, True

    suffix = datetime.now(UTC).strftime("%Y%m%d_%H%M%S") if force else sha[:8]
    relative = cover_relative_path(
        library_id=library_id,
        draft_id=draft_id,
        project_name=project_name,
        style_id=style_id,
        size_preset_id=size_preset_id,
        unique_suffix=suffix,
    )
    if not force and cover_absolute_path(relative).is_file():
        return relative, True

    _write_cover_file(relative, file_bytes, force=True)
    return relative, False


def save_ai_cover_png(
    file_bytes: bytes,
    *,
    library_id: int,
    draft_id: int,
    project_name: str,
    style_id: str,
    size_preset_id: str,
    prompt_hash: str,
    force: bool = False,
    existing_prompt_hash: str | None = None,
    existing_cover_path: str | None = None,
) -> tuple[str, bool]:
    """保存 AI 封面；force 时写入新时间戳文件，保留历史版本。"""
    validate_cover_png(file_bytes)
    h = (prompt_hash or "unknown").strip() or "unknown"

    if (
        not force
        and existing_prompt_hash == h
        and existing_cover_path
    ):
        existing_absolute = cover_absolute_path(existing_cover_path)
        if existing_absolute.is_file() and existing_absolute.stat().st_size > 0:
            return existing_cover_path, True

    suffix = datetime.now(UTC).strftime("%Y%m%d_%H%M%S") if force else h[:8]
    relative = cover_relative_path(
        library_id=library_id,
        draft_id=draft_id,
        project_name=project_name,
        style_id=style_id,
        size_preset_id=size_preset_id,
        unique_suffix=suffix,
    )
    if not force and cover_absolute_path(relative).is_file():
        return relative, True

    _write_cover_file(relative, file_bytes, force=True)
    return relative, False


STYLE_EXAMPLE_ASSETS_PREFIX = "_shared"
STYLE_REFERENCE_ASSETS_PREFIX = f"{STYLE_EXAMPLE_ASSETS_PREFIX}/references"
_MAX_REFERENCE_BYTES = 4 * 1024 * 1024
_REFERENCE_ID_PREFIX = "ref-"
_REFERENCE_EXTENSIONS = ("png", "jpg", "webp")
_REFERENCE_MIME_BY_EXT = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "webp": "image/webp",
}


def style_example_relative_path(*, style_id: str, library_id: int | None = None) -> str:
    del library_id
    slug = slugify_cover_filename_part(style_id)
    return f"{STYLE_EXAMPLE_ASSETS_PREFIX}/styles/{slug}/example.png"


def legacy_style_example_relative_path(*, library_id: int, style_id: str) -> str:
    slug = slugify_cover_filename_part(style_id)
    return f"{library_id}/styles/{slug}/example.png"


def save_style_example_png(
    file_bytes: bytes,
    *,
    library_id: int | None = None,
    style_id: str,
    force: bool = False,
) -> str:
    validate_cover_png(file_bytes)
    relative = style_example_relative_path(style_id=style_id)
    _write_cover_file(relative, file_bytes, force=force)
    return relative


def resolve_style_example_path(
    *,
    style_id: str,
    stored_path: str | None = None,
    library_id: int | None = None,
) -> str | None:
    """解析风格示例图相对路径：优先 DB 记录，否则全局约定路径，再兼容旧库级路径。"""
    if stored_path and stored_path.strip():
        absolute = cover_absolute_path(stored_path.strip())
        if absolute.is_file() and absolute.stat().st_size > 0:
            return stored_path.strip()
    shared = style_example_relative_path(style_id=style_id)
    absolute = cover_absolute_path(shared)
    if absolute.is_file() and absolute.stat().st_size > 0:
        return shared
    if library_id is not None:
        legacy = legacy_style_example_relative_path(library_id=library_id, style_id=style_id)
        legacy_absolute = cover_absolute_path(legacy)
        if legacy_absolute.is_file() and legacy_absolute.stat().st_size > 0:
            return legacy
    return None


def _reference_mime(file_bytes: bytes) -> str | None:
    if file_bytes.startswith(_PNG_MAGIC):
        return "image/png"
    if len(file_bytes) >= 3 and file_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(file_bytes) >= 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_reference_image(file_bytes: bytes) -> str:
    """校验参考图格式与大小，返回 MIME。"""
    if not file_bytes:
        raise ReadmeCoverError("参考图文件为空。")
    if len(file_bytes) > _MAX_REFERENCE_BYTES:
        raise ReadmeCoverError("参考图文件过大（上限 4MB）。")
    mime = _reference_mime(file_bytes)
    if mime is None:
        raise ReadmeCoverError("参考图须为 PNG、JPEG 或 WebP 格式。")
    return mime


def _reference_ext_for_mime(mime: str) -> str:
    for ext, mapped in _REFERENCE_MIME_BY_EXT.items():
        if mapped == mime:
            return ext
    raise ReadmeCoverError("不支持的参考图 MIME。")


def _normalize_reference_id(reference_id: str) -> str:
    ref_id = (reference_id or "").strip()
    if not ref_id.startswith(_REFERENCE_ID_PREFIX) or ".." in ref_id or "/" in ref_id:
        raise ReadmeCoverError("reference_id 无效。")
    return ref_id


def reference_upload_relative_path(*, reference_id: str, ext: str) -> str:
    ref_id = _normalize_reference_id(reference_id)
    if ext not in _REFERENCE_EXTENSIONS:
        raise ReadmeCoverError("reference_id 无效。")
    return f"{STYLE_REFERENCE_ASSETS_PREFIX}/{ref_id}.{ext}"


def save_reference_upload(file_bytes: bytes) -> tuple[str, str]:
    """保存临时参考图，返回 (reference_id, relative_path)。"""
    mime = validate_reference_image(file_bytes)
    ext = _reference_ext_for_mime(mime)
    reference_id = f"{_REFERENCE_ID_PREFIX}{secrets.token_hex(8)}"
    relative = reference_upload_relative_path(reference_id=reference_id, ext=ext)
    _write_cover_file(relative, file_bytes, force=True)
    return reference_id, relative


def load_reference_bytes(reference_id: str) -> tuple[bytes, str]:
    ref_id = _normalize_reference_id(reference_id)
    for ext in _REFERENCE_EXTENSIONS:
        relative = reference_upload_relative_path(reference_id=ref_id, ext=ext)
        absolute = cover_absolute_path(relative)
        if absolute.is_file() and absolute.stat().st_size > 0:
            data = absolute.read_bytes()
            mime = _reference_mime(data) or _REFERENCE_MIME_BY_EXT[ext]
            return data, mime
    raise ReadmeCoverError("参考图不存在或已过期，请重新上传。")


def delete_reference_upload(reference_id: str) -> None:
    ref_id = _normalize_reference_id(reference_id)
    for ext in _REFERENCE_EXTENSIONS:
        absolute = cover_absolute_path(reference_upload_relative_path(reference_id=ref_id, ext=ext))
        if absolute.is_file():
            absolute.unlink()


def style_reference_relative_path(*, style_id: str) -> str:
    slug = slugify_cover_filename_part(style_id)
    return f"{STYLE_EXAMPLE_ASSETS_PREFIX}/styles/{slug}/reference.png"


def archive_style_reference(file_bytes: bytes, *, style_id: str) -> str:
    validate_reference_image(file_bytes)
    relative = style_reference_relative_path(style_id=style_id)
    _write_cover_file(relative, file_bytes, force=True)
    return relative


def resolve_style_reference_path(
    *,
    style_id: str,
    stored_path: str | None = None,
) -> str | None:
    if stored_path and stored_path.strip():
        absolute = cover_absolute_path(stored_path.strip())
        if absolute.is_file() and absolute.stat().st_size > 0:
            return stored_path.strip()
    shared = style_reference_relative_path(style_id=style_id)
    absolute = cover_absolute_path(shared)
    if absolute.is_file() and absolute.stat().st_size > 0:
        return shared
    return None


def clone_style_example_image(
    *,
    source_style_id: str,
    source_stored_path: str | None,
    target_style_id: str,
    library_id: int | None = None,
) -> str | None:
    """Fork 时复制示例图到目标 style_id 专属路径，避免多风格共用同一文件。"""
    resolved = resolve_style_example_path(
        style_id=source_style_id,
        stored_path=source_stored_path,
        library_id=library_id,
    )
    if not resolved:
        return None
    absolute = cover_absolute_path(resolved)
    if not absolute.is_file() or absolute.stat().st_size <= 0:
        return None
    return save_style_example_png(absolute.read_bytes(), style_id=target_style_id, force=True)


def clone_style_reference_image(
    *,
    source_style_id: str,
    source_stored_path: str | None,
    target_style_id: str,
) -> str | None:
    """Fork 时复制灵感参考图到目标 style_id 专属路径。"""
    resolved = resolve_style_reference_path(
        style_id=source_style_id,
        stored_path=source_stored_path,
    )
    if not resolved:
        return None
    absolute = cover_absolute_path(resolved)
    if not absolute.is_file() or absolute.stat().st_size <= 0:
        return None
    return archive_style_reference(absolute.read_bytes(), style_id=target_style_id)


def reference_upload_media_type(relative_path: str) -> str:
    ext = Path(relative_path).suffix.lstrip(".").lower()
    return _REFERENCE_MIME_BY_EXT.get(ext, "application/octet-stream")

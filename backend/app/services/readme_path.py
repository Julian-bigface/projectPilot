"""仓库内 README / Markdown 文件路径校验（GitHub Contents API）。"""

from __future__ import annotations

import posixpath
from urllib.parse import unquote

from fastapi import HTTPException, status

_MAX_PATH_LEN = 256
_ALLOWED_SUFFIXES = (".md", ".markdown")


def normalize_repo_markdown_path(raw: str) -> str:
    """解码并规范化仓库内路径；非法时抛 400。"""
    decoded = unquote(raw.strip())
    if not decoded:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path 不能为空")
    if len(decoded) > _MAX_PATH_LEN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path 过长")
    normalized = posixpath.normpath(decoded.lstrip("/"))
    if normalized in (".", ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path 无效")
    parts = [p for p in normalized.split("/") if p]
    if ".." in parts or normalized.startswith(".."):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path 不允许包含 ..")
    lower = normalized.lower()
    if not any(lower.endswith(suffix) for suffix in _ALLOWED_SUFFIXES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="path 须为 .md 或 .markdown 文件",
        )
    return normalized

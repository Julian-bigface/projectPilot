"""README 内相对图片路径解析（对齐前端 readme-media-resolve.ts）。"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from app.services.github_parse import parse_owner_repo


def _normalize_repo_path(path: str) -> str:
    parts = [p for p in path.split("/") if p and p != "."]
    out: list[str] = []
    for part in parts:
        if part == "..":
            if out:
                out.pop()
            continue
        out.append(part)
    return "/".join(out)


def readme_directory_from_base_path(readme_base_path: str | None) -> str:
    if not readme_base_path or not readme_base_path.strip():
        return ""
    parts = _normalize_repo_path(readme_base_path.strip()).split("/")
    if len(parts) <= 1:
        return ""
    return "/".join(parts[:-1])


def github_normalized_url(full_name: str, github_url: str | None) -> str | None:
    parsed = parse_owner_repo(full_name, github_url)
    if not parsed:
        return None
    owner, repo = parsed
    return f"https://github.com/{owner}/{repo}"


def readme_raw_base_url(full_name: str, github_url: str | None, readme_base_path: str | None) -> str | None:
    base = github_normalized_url(full_name, github_url)
    if not base:
        return None
    directory = readme_directory_from_base_path(readme_base_path)
    suffix = f"{directory}/" if directory else ""
    return f"{base}/raw/HEAD/{suffix}"


def resolve_readme_image_src(
    src: str | None,
    *,
    full_name: str,
    github_url: str | None,
    readme_base_path: str | None,
) -> str | None:
    if not src or not src.strip():
        return src
    trimmed = src.strip()
    if re.match(r"^(https?:|data:|//)", trimmed, re.I):
        return trimmed
    base = readme_raw_base_url(full_name, github_url, readme_base_path)
    if not base:
        return trimmed
    return urljoin(base, trimmed)

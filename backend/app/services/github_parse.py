"""从 full_name 或 github URL 解析 GitHub owner/repo（对齐前端 parseGithubRepoUrl 语义）。"""

from __future__ import annotations

import re


def parse_owner_repo(full_name: str, github_url: str | None) -> tuple[str, str] | None:
    fn = full_name.strip()
    parts = fn.split("/")
    if len(parts) == 2 and parts[0] and parts[1]:
        return parts[0], parts[1]

    raw = (github_url or "").strip()
    if not raw:
        return None
    url_str = raw if re.match(r"^https?://", raw, re.I) else f"https://{raw}"
    try:
        from urllib.parse import urlparse

        u = urlparse(url_str)
    except Exception:  # noqa: BLE001
        return None
    host = u.hostname or ""
    host = re.sub(r"^www\.", "", host, flags=re.I)
    if host != "github.com":
        return None
    path_parts = [p for p in u.path.split("/") if p]
    if len(path_parts) < 2:
        return None
    owner = path_parts[0]
    repo = re.sub(r"\.git$", "", path_parts[1], flags=re.I)
    if owner and repo:
        return owner, repo
    return None

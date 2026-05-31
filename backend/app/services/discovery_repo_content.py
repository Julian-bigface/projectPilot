"""发现预览：按 owner/repo 从 GitHub 拉 README / Releases（不写入 projects 表）。"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.project_github import (
    ProjectReadmeRead,
    ProjectReleaseRead,
    ProjectReleasesRead,
)
from app.services.github_client import (
    fetch_readme_from_github,
    fetch_repo_file_raw,
    fetch_releases,
)
from app.services.project_github_content import (
    _GITHUB_FAILED_DETAIL,
    _map_release_item,
)
from app.services.readme_path import normalize_repo_markdown_path
from app.services.settings_github import effective_github_token, get_github_token_row


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def _resolve_github_token(db: AsyncSession) -> str:
    token = effective_github_token(await get_github_token_row(db), settings.github_token)
    if not token:
        raise HTTPException(status_code=status.HTTP_424_FAILED_DEPENDENCY, detail=_GITHUB_FAILED_DETAIL)
    return token


def _validate_owner_repo(owner: str, repo: str) -> tuple[str, str]:
    o = owner.strip()
    r = repo.strip()
    if not o or not r:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="owner 与 repo 不能为空")
    return o, r


async def fetch_discovery_repo_readme(
    db: AsyncSession,
    owner: str,
    repo: str,
    *,
    path: str | None = None,
    fresh: bool = False,  # noqa: ARG001 — 预览态始终走 GitHub
) -> ProjectReadmeRead:
    o, r = _validate_owner_repo(owner, repo)
    token = await _resolve_github_token(db)

    normalized: str | None = None
    if path is not None and path.strip():
        normalized = normalize_repo_markdown_path(path)

    if normalized is not None:
        content = await fetch_repo_file_raw(o, r, token, normalized)
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_424_FAILED_DEPENDENCY,
                detail=f"无法获取文件 {normalized}：请确认路径存在且为 Markdown 文件。",
            )
        return ProjectReadmeRead(
            content=content,
            source="github",
            path=normalized,
            is_default=False,
        )

    live = await fetch_readme_from_github(o, r, token)
    if live is None:
        raise HTTPException(status_code=status.HTTP_424_FAILED_DEPENDENCY, detail=_GITHUB_FAILED_DETAIL)

    now = _utcnow()
    return ProjectReadmeRead(
        content=live.content,
        source="github",
        path=live.path,
        is_default=True,
        cached_at=now,
        github_sha=live.sha,
        content_changed=False,
    )


async def fetch_discovery_repo_releases(
    db: AsyncSession,
    owner: str,
    repo: str,
    *,
    fresh: bool = False,  # noqa: ARG001 — 预览态始终走 GitHub
) -> ProjectReleasesRead:
    o, r = _validate_owner_repo(owner, repo)
    token = await _resolve_github_token(db)

    raw_list = await fetch_releases(o, r, token)
    items: list[ProjectReleaseRead] = []
    for raw in raw_list:
        mapped = _map_release_item(raw)
        if mapped is not None:
            items.append(mapped)

    return ProjectReleasesRead(
        items=items,
        source="github",
        cached_at=_utcnow(),
        content_changed=False,
    )

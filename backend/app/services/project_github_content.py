"""从 GitHub 拉取项目 README / Releases（详情页 Tab 用）。"""

from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.project import Project
from app.schemas.project_github import ProjectReadmeRead, ProjectReleaseRead, ProjectReleasesRead
from app.services.github_client import fetch_readme_raw, fetch_releases
from app.services.github_parse import parse_owner_repo
from app.services.settings_github import effective_github_token, get_github_token_row

_GITHUB_FAILED_DETAIL = (
    "无法从 GitHub 获取内容：请配置 Token，或确认仓库为 github.com 且 "
    "full_name / 链接可解析为 owner/repo。"
)


def _parse_github_datetime(iso: str | None) -> datetime | None:
    if not iso or not isinstance(iso, str):
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None


async def _resolve_owner_repo_token(
    db: AsyncSession, project: Project
) -> tuple[str, str, str]:
    token = effective_github_token(await get_github_token_row(db), settings.github_token)
    if not token:
        raise HTTPException(status_code=status.HTTP_424_FAILED_DEPENDENCY, detail=_GITHUB_FAILED_DETAIL)
    parsed = parse_owner_repo(project.full_name, project.github_url)
    if not parsed:
        raise HTTPException(status_code=status.HTTP_424_FAILED_DEPENDENCY, detail=_GITHUB_FAILED_DETAIL)
    owner, repo = parsed
    return owner, repo, token


async def fetch_project_readme(db: AsyncSession, project: Project) -> ProjectReadmeRead:
    owner, repo, token = await _resolve_owner_repo_token(db, project)
    content = await fetch_readme_raw(owner, repo, token)
    if content is None:
        raise HTTPException(status_code=status.HTTP_424_FAILED_DEPENDENCY, detail=_GITHUB_FAILED_DETAIL)
    return ProjectReadmeRead(content=content)


def _map_release_item(raw: dict) -> ProjectReleaseRead | None:
    tag = raw.get("tag_name")
    if not isinstance(tag, str) or not tag.strip():
        return None
    name = raw.get("name")
    body = raw.get("body")
    html_url = raw.get("html_url")
    published = raw.get("published_at")
    return ProjectReleaseRead(
        tag_name=tag.strip(),
        name=name if isinstance(name, str) and name.strip() else None,
        body=body if isinstance(body, str) else None,
        published_at=_parse_github_datetime(published) if isinstance(published, str) else None,
        html_url=html_url if isinstance(html_url, str) and html_url.strip() else None,
        prerelease=bool(raw.get("prerelease")),
        draft=bool(raw.get("draft")),
    )


async def fetch_project_releases(db: AsyncSession, project: Project) -> ProjectReleasesRead:
    owner, repo, token = await _resolve_owner_repo_token(db, project)
    raw_list = await fetch_releases(owner, repo, token)
    items: list[ProjectReleaseRead] = []
    for raw in raw_list:
        mapped = _map_release_item(raw)
        if mapped is not None:
            items.append(mapped)
    return ProjectReleasesRead(items=items)

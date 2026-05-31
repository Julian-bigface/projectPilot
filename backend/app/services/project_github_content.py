"""从 GitHub 拉取项目 README / Releases（详情页 Tab 用）。"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import ValidationError

from app.core.config import settings
from app.models.project import Project
from app.schemas.project_github import (
    ProjectReadmeRead,
    ProjectReleaseAssetRead,
    ProjectReleaseRead,
    ProjectReleasesRead,
)
from app.services.github_client import (
    fetch_readme_from_github,
    fetch_repo_file_raw,
    fetch_releases,
)
from app.services.readme_path import normalize_repo_markdown_path
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


def _utcnow() -> datetime:
    return datetime.now(UTC)


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


def _cached_default_readme_response(project: Project) -> ProjectReadmeRead:
    return ProjectReadmeRead(
        content=project.readme_cached or "",
        source="cache",
        path=project.readme_cached_path,
        is_default=True,
        cached_at=project.readme_cached_at,
        github_sha=project.readme_github_sha,
        content_changed=False,
    )


async def _sync_default_readme_from_github(
    db: AsyncSession,
    project: Project,
    *,
    owner: str,
    repo: str,
    token: str,
) -> ProjectReadmeRead:
    live = await fetch_readme_from_github(owner, repo, token)
    if live is None:
        raise HTTPException(status_code=status.HTTP_424_FAILED_DEPENDENCY, detail=_GITHUB_FAILED_DETAIL)

    old_sha = project.readme_github_sha
    content_changed = old_sha is not None and live.sha != old_sha
    if content_changed:
        project.readme_translated = None

    project.readme_cached = live.content
    project.readme_github_sha = live.sha
    project.readme_cached_path = live.path
    project.readme_cached_at = _utcnow()
    project.updated_at = _utcnow()
    await db.commit()
    await db.refresh(project)

    return ProjectReadmeRead(
        content=live.content,
        source="github",
        path=live.path,
        is_default=True,
        cached_at=project.readme_cached_at,
        github_sha=live.sha,
        content_changed=content_changed,
    )


async def fetch_project_readme(
    db: AsyncSession,
    project: Project,
    *,
    path: str | None = None,
    fresh: bool = False,
) -> ProjectReadmeRead:
    normalized: str | None = None
    if path is not None and path.strip():
        normalized = normalize_repo_markdown_path(path)

    if normalized is not None:
        owner, repo, token = await _resolve_owner_repo_token(db, project)
        content = await fetch_repo_file_raw(owner, repo, token, normalized)
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

    has_cache = bool(project.readme_cached and project.readme_cached.strip())
    if not fresh and has_cache:
        return _cached_default_readme_response(project)

    owner, repo, token = await _resolve_owner_repo_token(db, project)
    return await _sync_default_readme_from_github(
        db, project, owner=owner, repo=repo, token=token
    )


def default_readme_content_or_none(project: Project) -> str | None:
    """默认 README 缓存正文；无缓存时返回 None。"""
    text = project.readme_cached
    if text and text.strip():
        return text
    return None


async def ensure_default_readme_content(db: AsyncSession, project: Project) -> str:
    """优先读缓存；无缓存时拉 GitHub 并写入。"""
    cached = default_readme_content_or_none(project)
    if cached is not None:
        return cached
    readme = await fetch_project_readme(db, project, fresh=False)
    return readme.content


def _safe_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return None


def _map_release_assets(raw: dict) -> list[ProjectReleaseAssetRead]:
    assets_raw = raw.get("assets")
    if not isinstance(assets_raw, list):
        return []
    assets: list[ProjectReleaseAssetRead] = []
    for item in assets_raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        url = item.get("browser_download_url")
        if not isinstance(name, str) or not name.strip():
            continue
        if not isinstance(url, str) or not url.strip():
            continue
        updated = item.get("updated_at")
        assets.append(
            ProjectReleaseAssetRead(
                name=name.strip(),
                size=_safe_int(item.get("size")),
                download_count=_safe_int(item.get("download_count")) or 0,
                browser_download_url=url.strip(),
                updated_at=_parse_github_datetime(updated) if isinstance(updated, str) else None,
            )
        )
    return assets


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
        assets=_map_release_assets(raw),
    )


def _releases_cache_fingerprint(items: list[ProjectReleaseRead]) -> str:
    chunks: list[str] = []
    for item in items[:15]:
        pub = item.published_at.isoformat() if item.published_at else ""
        chunks.append(f"{item.tag_name}:{pub}:{len(item.assets)}")
    return f"n={len(items)};" + ";".join(chunks)


def _serialize_releases(items: list[ProjectReleaseRead]) -> list[dict]:
    return [item.model_dump(mode="json") for item in items]


def _load_cached_releases(project: Project) -> list[ProjectReleaseRead] | None:
    raw = project.releases_cached
    if raw is None:
        return None
    if not isinstance(raw, list):
        return None
    items: list[ProjectReleaseRead] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        try:
            items.append(ProjectReleaseRead.model_validate(entry))
        except ValidationError:
            continue
    return items


def _cached_releases_response(project: Project, items: list[ProjectReleaseRead]) -> ProjectReleasesRead:
    return ProjectReleasesRead(
        items=items,
        source="cache",
        cached_at=project.releases_cached_at,
        content_changed=False,
    )


async def _sync_releases_from_github(
    db: AsyncSession,
    project: Project,
    *,
    owner: str,
    repo: str,
    token: str,
) -> ProjectReleasesRead:
    raw_list = await fetch_releases(owner, repo, token)
    items: list[ProjectReleaseRead] = []
    for raw in raw_list:
        mapped = _map_release_item(raw)
        if mapped is not None:
            items.append(mapped)

    fingerprint = _releases_cache_fingerprint(items)
    old_fp = project.releases_cache_fingerprint
    content_changed = old_fp is not None and fingerprint != old_fp

    project.releases_cached = _serialize_releases(items)
    project.releases_cache_fingerprint = fingerprint
    project.releases_cached_at = _utcnow()
    project.updated_at = _utcnow()
    await db.commit()
    await db.refresh(project)

    return ProjectReleasesRead(
        items=items,
        source="github",
        cached_at=project.releases_cached_at,
        content_changed=content_changed,
    )


async def fetch_project_releases(
    db: AsyncSession,
    project: Project,
    *,
    fresh: bool = False,
) -> ProjectReleasesRead:
    cached_items = _load_cached_releases(project)
    if not fresh and cached_items is not None:
        return _cached_releases_response(project, cached_items)

    owner, repo, token = await _resolve_owner_repo_token(db, project)
    return await _sync_releases_from_github(
        db, project, owner=owner, repo=repo, token=token
    )

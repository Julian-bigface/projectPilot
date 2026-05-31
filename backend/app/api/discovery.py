from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.schemas.discovery import (
    DiscoveryEnrichRead,
    DiscoveryEnrichRequest,
    DiscoveryPageRead,
    DiscoveryTopicSearchMetaRead,
    TrendingRange,
)
from app.schemas.project_github import ProjectReadmeRead, ProjectReleasesRead
from app.services.discovery_enrich import enrich_discovery_repos_by_name, repo_from_rss_stub
from app.services.discovery_repo_content import (
    fetch_discovery_repo_readme,
    fetch_discovery_repo_releases,
)
from app.services.discovery_search import (
    build_hot_release_query,
    build_most_popular_query,
    fetch_search_channel_page,
)
from app.services.discovery_topic_query import TopicSearchMeta, resolve_topic_search
from app.services.discovery_trending import fetch_trending_page
from app.services.settings_github import effective_github_token, get_github_token_row

router = APIRouter()

_GITHUB_TOKEN_DETAIL = (
    "需要配置 GitHub Token 才能使用此发现频道。请在设置中配置 Token。"
)


async def _require_github_token(db: AsyncSession) -> str:
    token = effective_github_token(await get_github_token_row(db), settings.github_token)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=_GITHUB_TOKEN_DETAIL,
        )
    return token


def _clamp_per_page(per_page: int) -> int:
    return max(1, min(per_page, 50))


@router.get("/trending", response_model=DiscoveryPageRead)
async def discovery_trending(
    db: AsyncSession = Depends(get_db),
    range: TrendingRange = Query("weekly", alias="range"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    fresh: bool = Query(False, description="忽略 RSS 缓存，重新拉取 GitHubTrendingRSS"),
) -> DiscoveryPageRead:
    per_page = _clamp_per_page(per_page)
    try:
        return await fetch_trending_page(
            db,
            time_range=range,
            page=page,
            per_page=per_page,
            fresh=fresh,
        )
    except httpx.HTTPStatusError as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"无法拉取趋势 RSS：{err}",
        ) from err
    except ET.ParseError as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"趋势 RSS 解析失败：{err}",
        ) from err


@router.post("/repos/enrich", response_model=DiscoveryEnrichRead)
async def discovery_repos_enrich(
    body: DiscoveryEnrichRequest,
    db: AsyncSession = Depends(get_db),
) -> DiscoveryEnrichRead:
    """并行补全趋势 RSS 条目的 language / topics 等（走 GitHub API + SQLite 仓库缓存）。"""
    from datetime import UTC, datetime

    from app.schemas.discovery import DiscoveryRepoRead

    token = effective_github_token(await get_github_token_row(db), settings.github_token)

    stubs: dict[str, DiscoveryRepoRead] = {}
    entries: list[tuple[str, int]] = []
    for entry in body.items:
        fn = entry.full_name.strip()
        entries.append((fn, entry.rank))
        owner, _, repo_name = fn.partition("/")
        html_url = entry.html_url or f"https://github.com/{fn}"
        stubs[fn] = repo_from_rss_stub(
            rank=entry.rank,
            full_name=fn,
            html_url=html_url,
            description=entry.description,
            stars=entry.stars,
            forks=entry.forks,
        )
        if entry.name:
            stubs[fn] = stubs[fn].model_copy(update={"name": entry.name})

    enriched = await enrich_discovery_repos_by_name(db, entries, stubs, token)
    return DiscoveryEnrichRead(items=enriched, fetched_at=datetime.now(UTC))


@router.get("/repos/{owner}/{repo}/readme", response_model=ProjectReadmeRead)
async def discovery_repo_readme(
    owner: str,
    repo: str,
    db: AsyncSession = Depends(get_db),
    path: str | None = Query(None, description="仓库内 Markdown 相对路径"),
    fresh: bool = Query(False, description="预览态始终从 GitHub 拉取；保留参数与项目详情 API 一致"),
) -> ProjectReadmeRead:
    """发现预览：按 owner/repo 拉 README，不写入 projects 表。"""
    return await fetch_discovery_repo_readme(db, owner, repo, path=path, fresh=fresh)


@router.get("/repos/{owner}/{repo}/releases", response_model=ProjectReleasesRead)
async def discovery_repo_releases(
    owner: str,
    repo: str,
    db: AsyncSession = Depends(get_db),
    fresh: bool = Query(False, description="预览态始终从 GitHub 拉取"),
) -> ProjectReleasesRead:
    """发现预览：按 owner/repo 拉 Releases，不写入 projects 表。"""
    return await fetch_discovery_repo_releases(db, owner, repo, fresh=fresh)


@router.get("/hot-release", response_model=DiscoveryPageRead)
async def discovery_hot_release(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    fresh: bool = Query(False),
) -> DiscoveryPageRead:
    per_page = _clamp_per_page(per_page)
    token = await _require_github_token(db)
    query = build_hot_release_query()
    try:
        return await fetch_search_channel_page(
            db,
            channel="hot-release",
            query=query,
            sort="updated",
            page=page,
            per_page=per_page,
            token=token,
            fresh=fresh,
        )
    except RuntimeError as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(err),
        ) from err


@router.get("/most-popular", response_model=DiscoveryPageRead)
async def discovery_most_popular(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    fresh: bool = Query(False),
) -> DiscoveryPageRead:
    per_page = _clamp_per_page(per_page)
    token = await _require_github_token(db)
    query = build_most_popular_query()
    try:
        return await fetch_search_channel_page(
            db,
            channel="most-popular",
            query=query,
            sort="stars",
            page=page,
            per_page=per_page,
            token=token,
            fresh=fresh,
        )
    except RuntimeError as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(err),
        ) from err


def _topic_search_meta_to_read(meta: TopicSearchMeta) -> DiscoveryTopicSearchMetaRead:
    return DiscoveryTopicSearchMetaRead(
        mode=meta.mode,
        terms=list(meta.terms),
        category_name=meta.category_name,
        translated=meta.translated,
        translation_failed=meta.translation_failed,
    )


@router.get("/topic", response_model=DiscoveryPageRead)
async def discovery_topic(
    db: AsyncSession = Depends(get_db),
    topic: str = Query(..., min_length=1, max_length=128),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    fresh: bool = Query(False),
) -> DiscoveryPageRead:
    per_page = _clamp_per_page(per_page)
    token = await _require_github_token(db)
    query, search_meta = await resolve_topic_search(db, topic)
    try:
        page_read = await fetch_search_channel_page(
            db,
            channel="topic",
            query=query,
            sort="stars",
            page=page,
            per_page=per_page,
            token=token,
            fresh=fresh,
        )
    except RuntimeError as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(err),
        ) from err
    return page_read.model_copy(update={"search_meta": _topic_search_meta_to_read(search_meta)})

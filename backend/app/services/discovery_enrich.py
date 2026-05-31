from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.discovery import DiscoveryRepoRead
from app.services.discovery_cache import get_repo_cache, set_repo_cache_batch
from app.services.github_client import fetch_repository_json, github_auth_headers

_ENRICH_CONCURRENCY = 10
_GITHUB_TIMEOUT = httpx.Timeout(25.0)
_GITHUB_DESCRIPTION_MAX_LEN = 350


def is_rss_aggregate_description(desc: str | None) -> bool:
    """趋势 RSS 的 description 常含 README 摘录，非 GitHub 短简介。"""
    if not desc or not desc.strip():
        return False
    text = desc.strip()
    if len(text) > _GITHUB_DESCRIPTION_MAX_LEN:
        return True
    if "▒" in text or "░" in text:
        return True
    if text.startswith("⭐") and "|" in text and len(text) < 80:
        return True
    return False


def pick_repo_description(
    base: DiscoveryRepoRead,
    enriched: DiscoveryRepoRead,
) -> str | None:
    gh = (enriched.description or "").strip() or None
    if gh:
        return gh
    base_desc = (base.description or "").strip() or None
    if base_desc and not is_rss_aggregate_description(base_desc):
        return base_desc
    return None


def _parse_github_datetime(iso: str | None) -> datetime | None:
    if not iso or not isinstance(iso, str):
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None


def repo_from_github_json(data: dict[str, Any], *, rank: int) -> DiscoveryRepoRead:
    owner_obj = data.get("owner") if isinstance(data.get("owner"), dict) else {}
    login = owner_obj.get("login") if isinstance(owner_obj.get("login"), str) else None
    avatar = owner_obj.get("avatar_url") if isinstance(owner_obj.get("avatar_url"), str) else None
    fn = data.get("full_name") if isinstance(data.get("full_name"), str) else ""
    name = data.get("name") if isinstance(data.get("name"), str) else fn.split("/")[-1]
    html_url = data.get("html_url") if isinstance(data.get("html_url"), str) else f"https://github.com/{fn}"
    topics_raw = data.get("topics")
    topics = [t for t in topics_raw if isinstance(t, str)] if isinstance(topics_raw, list) else []
    desc = data.get("description")
    lang = data.get("language")
    pushed = data.get("pushed_at")
    return DiscoveryRepoRead(
        rank=rank,
        full_name=fn,
        name=name,
        github_url=html_url,
        html_url=html_url,
        description=desc if isinstance(desc, str) else None,
        stars=int(data.get("stargazers_count") or 0),
        forks=int(data.get("forks_count") or data.get("forks") or 0),
        language=lang if isinstance(lang, str) else None,
        topics=topics,
        owner_login=login,
        owner_avatar_url=avatar,
        pushed_at=_parse_github_datetime(pushed) if isinstance(pushed, str) else None,
    )


def repo_from_rss_stub(
    *,
    rank: int,
    full_name: str,
    html_url: str,
    description: str | None,
    stars: int,
    forks: int,
) -> DiscoveryRepoRead:
    owner, _, repo_name = full_name.partition("/")
    return DiscoveryRepoRead(
        rank=rank,
        full_name=full_name,
        name=repo_name or full_name,
        github_url=html_url,
        html_url=html_url,
        description=description,
        stars=stars,
        forks=forks,
        owner_login=owner or None,
        owner_avatar_url=f"https://github.com/{owner}.png" if owner else None,
    )


def _needs_github_enrich(item: DiscoveryRepoRead) -> bool:
    """RSS 常无 star/language；含 RSS 聚合简介时需补 GitHub 短 description。"""
    return (
        not item.language
        or item.stars == 0
        or is_rss_aggregate_description(item.description)
    )


def _merge_enriched(base: DiscoveryRepoRead, enriched: DiscoveryRepoRead) -> DiscoveryRepoRead:
    """RSS 优先保留已有 star/fork；缺失时用 GitHub 补全。"""
    return base.model_copy(
        update={
            "language": enriched.language or base.language,
            "topics": enriched.topics if enriched.topics else base.topics,
            "stars": base.stars if base.stars > 0 else enriched.stars,
            "forks": base.forks if base.forks > 0 else enriched.forks,
            "owner_login": enriched.owner_login or base.owner_login,
            "owner_avatar_url": enriched.owner_avatar_url or base.owner_avatar_url,
            "pushed_at": enriched.pushed_at or base.pushed_at,
            "description": pick_repo_description(base, enriched),
            "name": base.name or enriched.name,
        }
    )


async def _fetch_github_repo(
    client: httpx.AsyncClient,
    base: DiscoveryRepoRead,
    token: str,
) -> DiscoveryRepoRead | None:
    parts = base.full_name.split("/", 1)
    if len(parts) != 2:
        return None
    owner, repo = parts
    headers = github_auth_headers(token)
    try:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers,
        )
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    try:
        data = response.json()
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(data, dict):
        return None
    return repo_from_github_json(data, rank=base.rank)


async def _resolve_from_cache_or_base(
    db: AsyncSession,
    item: DiscoveryRepoRead,
    token: str | None,
) -> tuple[DiscoveryRepoRead, bool]:
    """返回 (当前最佳条目, 是否仍需 GitHub)。"""
    cached = await get_repo_cache(db, item.full_name)
    if cached:
        merged = _merge_enriched(item, cached)
        if not _needs_github_enrich(merged):
            return merged, False
        if not token:
            return merged, False
        return merged, True

    if not _needs_github_enrich(item):
        return item, False
    if not token:
        return item, False
    return item, True


async def enrich_discovery_repos(
    db: AsyncSession,
    items: list[DiscoveryRepoRead],
    token: str | None,
) -> list[DiscoveryRepoRead]:
    if not items:
        return []

    resolved: list[DiscoveryRepoRead | None] = [None] * len(items)
    github_jobs: list[tuple[int, DiscoveryRepoRead]] = []

    for index, item in enumerate(items):
        current, needs_github = await _resolve_from_cache_or_base(db, item, token)
        if not needs_github:
            resolved[index] = current
        else:
            github_jobs.append((index, current))

    if github_jobs and token:
        sem = asyncio.Semaphore(_ENRICH_CONCURRENCY)
        async with httpx.AsyncClient(timeout=_GITHUB_TIMEOUT) as client:

            async def run_job(index: int, base: DiscoveryRepoRead) -> tuple[int, DiscoveryRepoRead]:
                async with sem:
                    enriched = await _fetch_github_repo(client, base, token)
                if enriched:
                    return index, _merge_enriched(base, enriched)
                return index, base

            github_results = await asyncio.gather(
                *[run_job(index, base) for index, base in github_jobs]
            )
        for index, merged in github_results:
            resolved[index] = merged

    final = [row if row is not None else items[i] for i, row in enumerate(resolved)]

    if token:
        to_cache = [r for r in final if r.language and r.stars > 0]
        if to_cache:
            await set_repo_cache_batch(db, to_cache)

    return final


async def enrich_discovery_repos_by_name(
    db: AsyncSession,
    entries: list[tuple[str, int]],
    stubs: dict[str, DiscoveryRepoRead],
    token: str | None,
) -> list[DiscoveryRepoRead]:
    """按 full_name + rank 补全；stubs 提供 RSS 基础字段。"""
    items: list[DiscoveryRepoRead] = []
    for full_name, rank in entries:
        stub = stubs.get(full_name)
        if stub:
            items.append(stub.model_copy(update={"rank": rank}))
        else:
            owner, _, repo_name = full_name.partition("/")
            items.append(
                DiscoveryRepoRead(
                    rank=rank,
                    full_name=full_name,
                    name=repo_name or full_name,
                    github_url=f"https://github.com/{full_name}",
                    html_url=f"https://github.com/{full_name}",
                    owner_login=owner or None,
                    owner_avatar_url=f"https://github.com/{owner}.png" if owner else None,
                )
            )
    return await enrich_discovery_repos(db, items, token)

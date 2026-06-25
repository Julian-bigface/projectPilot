"""发现中心 SQLite 缓存：趋势 RSS 全榜、Search 分页、仓库 enrich 元数据。"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.discovery import DiscoveryRepoRead

TRENDING_FEED_TTL = timedelta(hours=1)
MOST_POPULAR_FEED_TTL = timedelta(hours=1)
SEARCH_FEED_TTL = timedelta(minutes=10)
REPO_CACHE_TTL = timedelta(hours=6)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _is_fresh(cached_at: datetime, ttl: timedelta) -> bool:
    return _utcnow() - cached_at < ttl


def trending_feed_cache_key(time_range: str) -> str:
    return f"trending:{time_range}"


def search_feed_cache_key(channel: str, query: str, page: int, per_page: int) -> str:
    return f"search:{channel}:{query}:p{page}:pp{per_page}"


async def get_feed_cache(
    db: AsyncSession, cache_key: str, ttl: timedelta
) -> list[DiscoveryRepoRead] | None:
    row = (
        await db.execute(
            text(
                "SELECT payload_json, cached_at FROM discovery_feed_cache "
                "WHERE cache_key = :key"
            ),
            {"key": cache_key},
        )
    ).fetchone()
    if row is None:
        return None
    payload_json, cached_at_raw = row[0], row[1]
    if not payload_json or not cached_at_raw:
        return None
    try:
        cached_at = datetime.fromisoformat(str(cached_at_raw).replace("Z", "+00:00"))
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=UTC)
    except ValueError:
        return None
    if not _is_fresh(cached_at, ttl):
        return None
    try:
        raw = json.loads(payload_json)
    except json.JSONDecodeError:
        return None
    if not isinstance(raw, list):
        return None
    items: list[DiscoveryRepoRead] = []
    for entry in raw:
        if isinstance(entry, dict):
            items.append(DiscoveryRepoRead.model_validate(entry))
    return items


async def set_feed_cache(db: AsyncSession, cache_key: str, items: list[DiscoveryRepoRead]) -> None:
    now = _utcnow()
    payload = json.dumps([item.model_dump(mode="json") for item in items], ensure_ascii=False)
    await db.execute(
        text(
            "INSERT INTO discovery_feed_cache (cache_key, payload_json, cached_at) "
            "VALUES (:key, :payload, :at) "
            "ON CONFLICT(cache_key) DO UPDATE SET "
            "payload_json = excluded.payload_json, cached_at = excluded.cached_at"
        ),
        {"key": cache_key, "payload": payload, "at": now.isoformat()},
    )
    await db.commit()


async def get_repo_cache(db: AsyncSession, full_name: str) -> DiscoveryRepoRead | None:
    row = (
        await db.execute(
            text(
                "SELECT payload_json, cached_at FROM discovery_repo_cache "
                "WHERE full_name = :fn"
            ),
            {"fn": full_name},
        )
    ).fetchone()
    if row is None:
        return None
    payload_json, cached_at_raw = row[0], row[1]
    if not payload_json or not cached_at_raw:
        return None
    try:
        cached_at = datetime.fromisoformat(str(cached_at_raw).replace("Z", "+00:00"))
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=UTC)
    except ValueError:
        return None
    if not _is_fresh(cached_at, REPO_CACHE_TTL):
        return None
    try:
        raw = json.loads(payload_json)
    except json.JSONDecodeError:
        return None
    if not isinstance(raw, dict):
        return None
    return DiscoveryRepoRead.model_validate(raw)


async def set_repo_cache(db: AsyncSession, repo: DiscoveryRepoRead, *, commit: bool = False) -> None:
    now = _utcnow()
    payload = repo.model_dump_json()
    await db.execute(
        text(
            "INSERT INTO discovery_repo_cache (full_name, payload_json, cached_at) "
            "VALUES (:fn, :payload, :at) "
            "ON CONFLICT(full_name) DO UPDATE SET "
            "payload_json = excluded.payload_json, cached_at = excluded.cached_at"
        ),
        {"fn": repo.full_name, "payload": payload, "at": now.isoformat()},
    )
    if commit:
        await db.commit()


async def set_repo_cache_batch(db: AsyncSession, repos: list[DiscoveryRepoRead]) -> None:
    for repo in repos:
        await set_repo_cache(db, repo, commit=False)
    await db.commit()

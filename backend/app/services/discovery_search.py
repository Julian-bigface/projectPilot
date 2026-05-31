from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.discovery import DiscoveryPageRead
from app.services.discovery_cache import (
    SEARCH_FEED_TTL,
    get_feed_cache,
    search_feed_cache_key,
    set_feed_cache,
)
from app.services.discovery_enrich import repo_from_github_json
from app.services.github_client import search_repositories

SearchSort = Literal["stars", "updated"]


def _date_days_ago(days: int) -> str:
    return (datetime.now(UTC) - timedelta(days=days)).date().isoformat()


def build_hot_release_query() -> str:
    fourteen_days = _date_days_ago(14)
    return f"stars:>10 archived:false pushed:>={fourteen_days}"


def build_most_popular_query() -> str:
    six_months = _date_days_ago(6 * 30)
    one_year = _date_days_ago(365)
    return f"stars:>1000 archived:false created:<{six_months} pushed:>={one_year}"


def build_topic_query(topic: str) -> str:
    cleaned = topic.strip()
    if cleaned.startswith("topic:"):
        return f"{cleaned} stars:>10 archived:false"
    return f"topic:{cleaned} stars:>10 archived:false"


async def fetch_search_channel_page(
    db: AsyncSession,
    *,
    channel: str,
    query: str,
    sort: SearchSort,
    page: int,
    per_page: int,
    token: str,
    fresh: bool = False,
) -> DiscoveryPageRead:
    cache_key = search_feed_cache_key(channel, query, page, per_page)
    if not fresh:
        cached_items = await get_feed_cache(db, cache_key, SEARCH_FEED_TTL)
        if cached_items is not None:
            return DiscoveryPageRead(
                items=cached_items,
                page=page,
                per_page=per_page,
                has_more=len(cached_items) == per_page,
                total_count=None,
                fetched_at=datetime.now(UTC),
                source="github_search",
            )

    data = await search_repositories(query, token, sort=sort, page=page, per_page=per_page)
    if data is None:
        raise RuntimeError("GitHub search request failed")

    items_raw = data.get("items")
    if not isinstance(items_raw, list):
        items_raw = []

    start_rank = (page - 1) * per_page + 1
    items = []
    for offset, raw in enumerate(items_raw):
        if isinstance(raw, dict):
            items.append(repo_from_github_json(raw, rank=start_rank + offset))

    total_count = data.get("total_count")
    total = int(total_count) if isinstance(total_count, int) else None
    has_more = len(items) == per_page

    await set_feed_cache(db, cache_key, items)

    return DiscoveryPageRead(
        items=items,
        page=page,
        per_page=per_page,
        has_more=has_more,
        total_count=total,
        fetched_at=datetime.now(UTC),
        source="github_search",
    )


def map_github_search_error(data: dict[str, Any] | None) -> str | None:
    if not data:
        return None
    message = data.get("message")
    return message if isinstance(message, str) else None

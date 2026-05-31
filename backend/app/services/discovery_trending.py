from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import UTC, datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.discovery import DiscoveryPageRead, DiscoveryRepoRead, TrendingRange
from app.services.discovery_cache import (
    TRENDING_FEED_TTL,
    get_feed_cache,
    set_feed_cache,
    trending_feed_cache_key,
)
from app.services.discovery_enrich import repo_from_rss_stub

TRENDING_RSS_BASE = "https://mshibanami.github.io/GitHubTrendingRSS"
_GITHUB_LINK_RE = re.compile(r"github\.com/([^/]+)/([^/?#]+)")
_STARS_RE = re.compile(r"⭐\s*([\d,]+)")
_FORKS_RE = re.compile(r"🍴\s*([\d,]+)")


def trending_rss_url(time_range: TrendingRange) -> str:
    return f"{TRENDING_RSS_BASE}/{time_range}/all.xml"


def parse_trending_rss_xml(xml_text: str) -> list[DiscoveryRepoRead]:
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        return []

    items: list[DiscoveryRepoRead] = []
    for index, item_el in enumerate(channel.findall("item")):
        title = (item_el.findtext("title") or "").strip()
        link = (item_el.findtext("link") or "").strip()
        description_raw = item_el.findtext("description") or ""
        description = _strip_html(description_raw)

        match = _GITHUB_LINK_RE.search(link)
        owner = match.group(1) if match else ""
        repo_name = match.group(2) if match else title
        full_name = f"{owner}/{repo_name}" if owner and repo_name else title

        stars_match = _STARS_RE.search(description)
        forks_match = _FORKS_RE.search(description)
        stars = int(stars_match.group(1).replace(",", "")) if stars_match else 0
        forks = int(forks_match.group(1).replace(",", "")) if forks_match else 0

        html_url = link or (f"https://github.com/{full_name}" if "/" in full_name else link)
        items.append(
            repo_from_rss_stub(
                rank=index + 1,
                full_name=full_name,
                html_url=html_url,
                description=None,
                stars=stars,
                forks=forks,
            )
        )
    return items


def _strip_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


async def fetch_trending_rss_xml(time_range: TrendingRange) -> str:
    url = trending_rss_url(time_range)
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            url,
            headers={"Accept": "application/rss+xml, application/xml, text/xml"},
        )
    if response.status_code != 200:
        raise httpx.HTTPStatusError(
            f"RSS fetch failed: HTTP {response.status_code}",
            request=response.request,
            response=response,
        )
    return response.text


async def load_trending_feed(
    db: AsyncSession,
    time_range: TrendingRange,
    *,
    fresh: bool = False,
) -> list[DiscoveryRepoRead]:
    cache_key = trending_feed_cache_key(time_range)
    if not fresh:
        cached = await get_feed_cache(db, cache_key, TRENDING_FEED_TTL)
        if cached is not None:
            return cached

    xml_text = await fetch_trending_rss_xml(time_range)
    all_items = parse_trending_rss_xml(xml_text)
    await set_feed_cache(db, cache_key, all_items)
    return all_items


async def fetch_trending_page(
    db: AsyncSession,
    *,
    time_range: TrendingRange,
    page: int,
    per_page: int,
    fresh: bool = False,
) -> DiscoveryPageRead:
    all_items = await load_trending_feed(db, time_range, fresh=fresh)
    total = len(all_items)
    start = (page - 1) * per_page
    end = start + per_page
    page_items = all_items[start:end]
    return DiscoveryPageRead(
        items=page_items,
        page=page,
        per_page=per_page,
        has_more=end < total,
        total_count=total,
        fetched_at=datetime.now(UTC),
        source="rss",
    )

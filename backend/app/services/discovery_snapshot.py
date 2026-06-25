"""发现趋势上一期快照：写入前轮换、读取与 delta 计算。"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.discovery import DiscoveryRepoDeltaRead, DiscoveryRepoRead


class TrendingSnapshotEntry(BaseModel):
    full_name: str
    rank: int = Field(..., ge=1)
    stars: int = Field(default=0, ge=0)
    forks: int = Field(default=0, ge=0)


def _parse_cached_at(raw: str) -> datetime | None:
    try:
        cached_at = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=UTC)
        return cached_at
    except ValueError:
        return None


def _entries_from_repo_items(items: list[DiscoveryRepoRead]) -> list[TrendingSnapshotEntry]:
    return [
        TrendingSnapshotEntry(
            full_name=item.full_name,
            rank=item.rank,
            stars=item.stars,
            forks=item.forks,
        )
        for item in items
    ]


def _entries_from_json(payload_json: str) -> list[TrendingSnapshotEntry]:
    try:
        raw = json.loads(payload_json)
    except json.JSONDecodeError:
        return []
    if not isinstance(raw, list):
        return []
    entries: list[TrendingSnapshotEntry] = []
    for entry in raw:
        if isinstance(entry, dict):
            try:
                entries.append(TrendingSnapshotEntry.model_validate(entry))
            except ValueError:
                continue
        elif isinstance(entry, str):
            continue
    return entries


async def get_feed_cache_entry(
    db: AsyncSession, cache_key: str
) -> tuple[list[DiscoveryRepoRead], datetime] | None:
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
    cached_at = _parse_cached_at(str(cached_at_raw))
    if cached_at is None:
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
    return items, cached_at


async def rotate_feed_snapshot(db: AsyncSession, cache_key: str) -> None:
    """将当前 feed 缓存写入上一期快照（覆盖写新榜前调用）。"""
    entry = await get_feed_cache_entry(db, cache_key)
    if entry is None:
        return
    items, cached_at = entry
    if not items:
        return
    snapshot_entries = _entries_from_repo_items(items)
    payload = json.dumps(
        [item.model_dump(mode="json") for item in snapshot_entries],
        ensure_ascii=False,
    )
    await db.execute(
        text(
            "INSERT INTO discovery_feed_snapshot (cache_key, payload_json, snapshot_at) "
            "VALUES (:key, :payload, :at) "
            "ON CONFLICT(cache_key) DO UPDATE SET "
            "payload_json = excluded.payload_json, "
            "snapshot_at = excluded.snapshot_at"
        ),
        {"key": cache_key, "payload": payload, "at": cached_at.isoformat()},
    )
    await db.commit()


async def load_feed_snapshot(
    db: AsyncSession, cache_key: str
) -> tuple[list[TrendingSnapshotEntry], datetime] | None:
    row = (
        await db.execute(
            text(
                "SELECT payload_json, snapshot_at FROM discovery_feed_snapshot "
                "WHERE cache_key = :key"
            ),
            {"key": cache_key},
        )
    ).fetchone()
    if row is None:
        return None
    payload_json, snapshot_at_raw = row[0], row[1]
    if not payload_json or not snapshot_at_raw:
        return None
    snapshot_at = _parse_cached_at(str(snapshot_at_raw))
    if snapshot_at is None:
        return None
    entries = _entries_from_json(str(payload_json))
    if not entries:
        return None
    return entries, snapshot_at


def compute_trending_deltas(
    current: list[DiscoveryRepoRead],
    previous: list[TrendingSnapshotEntry],
) -> dict[str, DiscoveryRepoDeltaRead]:
    prev_by_name = {entry.full_name: entry for entry in previous}
    deltas: dict[str, DiscoveryRepoDeltaRead] = {}

    for item in current:
        prev = prev_by_name.get(item.full_name)
        if prev is None:
            deltas[item.full_name] = DiscoveryRepoDeltaRead(is_new=True)
            continue

        stars_delta = item.stars - prev.stars
        forks_delta = item.forks - prev.forks
        rank_delta = prev.rank - item.rank

        if stars_delta == 0 and forks_delta == 0 and rank_delta == 0:
            continue

        deltas[item.full_name] = DiscoveryRepoDeltaRead(
            stars=stars_delta if stars_delta != 0 else None,
            forks=forks_delta if forks_delta != 0 else None,
            rank=rank_delta if rank_delta != 0 else None,
            is_new=False,
        )

    return deltas


def apply_trending_deltas(
    items: list[DiscoveryRepoRead],
    deltas: dict[str, DiscoveryRepoDeltaRead],
) -> list[DiscoveryRepoRead]:
    if not deltas:
        return items
    return [
        item.model_copy(update={"delta": deltas.get(item.full_name)})
        if item.full_name in deltas
        else item
        for item in items
    ]

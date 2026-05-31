"""发现「主题探索」搜索 query 扩展（分类多 Topic、中文双语）。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import FolderTag, ProjectTag, Tag, TagCategory
from app.services.discovery_search import build_topic_query
from app.services.translation_ephemeral import translate_to_english_for_search

DISCOVERY_CATEGORY_TAG_LIMIT = 8
GITHUB_SEARCH_MAX_QUERY_LEN = 256
UNCATEGORIZED_LABEL = "未分类"

_CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]")
_SLUG_INVALID_RE = re.compile(r"[^a-z0-9\-]+")

TopicSearchMode = Literal["category", "bilingual", "plain"]


@dataclass(frozen=True)
class TopicSearchMeta:
    mode: TopicSearchMode
    terms: list[str]
    category_name: str | None = None
    translated: str | None = None
    translation_failed: bool = False


def normalize_topic_input(raw: str) -> str:
    return " ".join(raw.strip().split())


def contains_cjk(text: str) -> bool:
    return _CJK_RE.search(text) is not None


def slugify_for_github_topic(text: str) -> str:
    cleaned = text.strip().lower().replace("_", "-")
    cleaned = re.sub(r"\s+", "-", cleaned)
    cleaned = _SLUG_INVALID_RE.sub("", cleaned)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    return cleaned


def _github_search_suffix() -> str:
    return "stars:>10 archived:false"


def _quote_github_term(term: str) -> str:
    if not term:
        return '""'
    if any(ch.isspace() for ch in term) or ":" in term:
        escaped = term.replace('"', '\\"')
        return f'"{escaped}"'
    return term


def build_multi_topic_or_query(topics: list[str]) -> str | None:
    slugs: list[str] = []
    seen: set[str] = set()
    for name in topics:
        slug = slugify_for_github_topic(name)
        if not slug or slug in seen:
            continue
        seen.add(slug)
        slugs.append(slug)

    if not slugs:
        return None

    suffix = _github_search_suffix()
    budget = GITHUB_SEARCH_MAX_QUERY_LEN - len(suffix) - 3
    selected: list[str] = []
    for slug in slugs:
        part = f"topic:{slug}"
        extra = len(" OR ") if selected else 0
        if sum(len(f"topic:{s}") for s in selected) + extra + len(part) > budget:
            break
        selected.append(slug)

    if not selected:
        selected = [slugs[0]]

    topic_clause = " OR ".join(f"topic:{slug}" for slug in selected)
    return f"({topic_clause}) {suffix}"


def build_bilingual_query(original: str, translated: str) -> tuple[str, TopicSearchMeta]:
    en_slug = slugify_for_github_topic(translated)
    en_text = translated.strip()
    parts: list[str] = []
    if en_slug:
        parts.append(f"topic:{en_slug}")
    parts.append(f"{_quote_github_term(original)} in:name,description,topics")
    if en_text and en_text != original:
        parts.append(f"{_quote_github_term(en_text)} in:name,description,topics")

    clause = " OR ".join(parts)
    query = f"({clause}) {_github_search_suffix()}"
    terms = [original]
    if en_slug:
        terms.append(en_slug)
    elif en_text:
        terms.append(en_text)
    return query, TopicSearchMeta(
        mode="bilingual",
        terms=terms,
        translated=en_text or None,
    )


async def _tags_with_usage_by_category_ids(
    db: AsyncSession,
    category_ids: list[int],
) -> list[tuple[str, int]]:
    if not category_ids:
        return []

    project_usage_sq = (
        select(ProjectTag.tag_id.label("tid"), func.count(ProjectTag.project_id).label("uc"))
        .group_by(ProjectTag.tag_id)
        .subquery()
    )
    folder_usage_sq = (
        select(FolderTag.tag_id.label("tid"), func.count(FolderTag.folder_id).label("uc"))
        .group_by(FolderTag.tag_id)
        .subquery()
    )

    stmt = (
        select(
            Tag.name,
            func.coalesce(project_usage_sq.c.uc, 0) + func.coalesce(folder_usage_sq.c.uc, 0),
        )
        .outerjoin(project_usage_sq, Tag.id == project_usage_sq.c.tid)
        .outerjoin(folder_usage_sq, Tag.id == folder_usage_sq.c.tid)
        .where(Tag.category_id.in_(category_ids))
    )
    rows = (await db.execute(stmt)).all()

    merged: dict[str, int] = {}
    for name, usage in rows:
        merged[name] = merged.get(name, 0) + int(usage or 0)

    return sorted(merged.items(), key=lambda item: (-item[1], item[0].lower()))


async def _uncategorized_tags_with_usage(db: AsyncSession) -> list[tuple[str, int]]:
    project_usage_sq = (
        select(ProjectTag.tag_id.label("tid"), func.count(ProjectTag.project_id).label("uc"))
        .group_by(ProjectTag.tag_id)
        .subquery()
    )
    folder_usage_sq = (
        select(FolderTag.tag_id.label("tid"), func.count(FolderTag.folder_id).label("uc"))
        .group_by(FolderTag.tag_id)
        .subquery()
    )

    stmt = (
        select(
            Tag.name,
            func.coalesce(project_usage_sq.c.uc, 0) + func.coalesce(folder_usage_sq.c.uc, 0),
        )
        .outerjoin(project_usage_sq, Tag.id == project_usage_sq.c.tid)
        .outerjoin(folder_usage_sq, Tag.id == folder_usage_sq.c.tid)
        .where(Tag.category_id.is_(None))
    )
    rows = (await db.execute(stmt)).all()

    merged: dict[str, int] = {}
    for name, usage in rows:
        merged[name] = merged.get(name, 0) + int(usage or 0)

    return sorted(merged.items(), key=lambda item: (-item[1], item[0].lower()))


async def _resolve_category_expansion(
    db: AsyncSession,
    normalized: str,
) -> tuple[str, TopicSearchMeta] | None:
    if normalized.casefold() == UNCATEGORIZED_LABEL.casefold():
        ranked = await _uncategorized_tags_with_usage(db)
        tag_names = [name for name, _ in ranked[:DISCOVERY_CATEGORY_TAG_LIMIT]]
        if not tag_names:
            return None
        query = build_multi_topic_or_query(tag_names)
        if not query:
            return None
        return query, TopicSearchMeta(
            mode="category",
            terms=tag_names,
            category_name=UNCATEGORIZED_LABEL,
        )

    cat_rows = (
        await db.execute(
            select(TagCategory.id, TagCategory.name).where(
                func.lower(TagCategory.name) == normalized.casefold()
            )
        )
    ).all()
    if not cat_rows:
        return None

    category_ids = [int(row[0]) for row in cat_rows]
    display_name = str(cat_rows[0][1])
    ranked = await _tags_with_usage_by_category_ids(db, category_ids)
    tag_names = [name for name, _ in ranked[:DISCOVERY_CATEGORY_TAG_LIMIT]]
    if not tag_names:
        return None

    query = build_multi_topic_or_query(tag_names)
    if not query:
        return None
    return query, TopicSearchMeta(
        mode="category",
        terms=tag_names,
        category_name=display_name,
    )


async def resolve_topic_search(db: AsyncSession, raw: str) -> tuple[str, TopicSearchMeta]:
    normalized = normalize_topic_input(raw)
    if not normalized:
        return build_topic_query("unknown"), TopicSearchMeta(mode="plain", terms=[])

    category_result = await _resolve_category_expansion(db, normalized)
    if category_result is not None:
        return category_result

    if contains_cjk(normalized):
        try:
            translated = await translate_to_english_for_search(db, normalized)
            return build_bilingual_query(normalized, translated)
        except Exception:
            query = f"{_quote_github_term(normalized)} in:name,description,topics {_github_search_suffix()}"
            return query, TopicSearchMeta(
                mode="bilingual",
                terms=[normalized],
                translation_failed=True,
            )

    return build_topic_query(normalized), TopicSearchMeta(
        mode="plain",
        terms=[normalized],
    )

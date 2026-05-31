from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base
from app.models.project_library import ProjectLibrary
from app.models.tag import FolderTag, ProjectTag, Tag, TagCategory
from app.services.discovery_topic_query import (
    build_bilingual_query,
    build_multi_topic_or_query,
    resolve_topic_search,
    slugify_for_github_topic,
)


def test_slugify_for_github_topic():
    assert slugify_for_github_topic("Machine Learning") == "machine-learning"
    assert slugify_for_github_topic("topic:Rust") == "topicrust"


def test_build_multi_topic_or_query():
    q = build_multi_topic_or_query(["rust", "go", "Rust"])
    assert q is not None
    assert "topic:rust" in q
    assert "topic:go" in q
    assert "stars:>10" in q
    assert q.count("topic:rust") == 1


def test_build_bilingual_query():
    q, meta = build_bilingual_query("机器学习", "machine learning")
    assert "topic:machine-learning" in q
    assert "机器学习" in q
    assert "machine learning" in q
    assert meta.mode == "bilingual"
    assert meta.translated == "machine learning"


async def _session(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'topic_query.db'}"
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, session_factory


async def _seed_category_tags(session: AsyncSession) -> None:
    lib_a = ProjectLibrary(name="库A", is_pinned=True)
    lib_b = ProjectLibrary(name="库B", is_pinned=False)
    session.add_all([lib_a, lib_b])
    await session.flush()

    cat_a = TagCategory(name="AI", project_library_id=lib_a.id, sort_order=0)
    cat_b = TagCategory(name="ai", project_library_id=lib_b.id, sort_order=0)
    session.add_all([cat_a, cat_b])
    await session.flush()

    tag_llm = Tag(name="llm", category_id=cat_a.id, project_library_id=lib_a.id)
    tag_agent = Tag(name="agent", category_id=cat_b.id, project_library_id=lib_b.id)
    tag_dup = Tag(name="llm", category_id=cat_b.id, project_library_id=lib_b.id)
    tag_uncat = Tag(name="rust", category_id=None, project_library_id=lib_a.id)
    session.add_all([tag_llm, tag_agent, tag_dup, tag_uncat])
    await session.flush()

    session.add_all(
        [
            ProjectTag(project_id=1, tag_id=tag_llm.id),
            ProjectTag(project_id=2, tag_id=tag_llm.id),
            ProjectTag(project_id=3, tag_id=tag_agent.id),
            FolderTag(folder_id=1, tag_id=tag_dup.id),
        ]
    )
    await session.commit()


@pytest.mark.asyncio
async def test_resolve_category_merges_across_libraries(tmp_path) -> None:
    engine, session_factory = await _session(tmp_path)
    async with session_factory() as session:
        await _seed_category_tags(session)
        query, meta = await resolve_topic_search(session, "AI")

    assert meta.mode == "category"
    assert meta.category_name == "AI"
    assert meta.terms[0] == "llm"
    assert "agent" in meta.terms
    assert "topic:llm" in query
    assert "topic:agent" in query
    await engine.dispose()


@pytest.mark.asyncio
async def test_resolve_uncategorized(tmp_path) -> None:
    engine, session_factory = await _session(tmp_path)
    async with session_factory() as session:
        await _seed_category_tags(session)
        query, meta = await resolve_topic_search(session, "未分类")

    assert meta.mode == "category"
    assert meta.category_name == "未分类"
    assert meta.terms == ["rust"]
    assert "topic:rust" in query
    await engine.dispose()


@pytest.mark.asyncio
async def test_resolve_plain_topic(tmp_path) -> None:
    engine, session_factory = await _session(tmp_path)
    async with session_factory() as session:
        query, meta = await resolve_topic_search(session, "rust")

    assert meta.mode == "plain"
    assert query == "topic:rust stars:>10 archived:false"
    await engine.dispose()


@pytest.mark.asyncio
async def test_resolve_bilingual_with_mock_translate(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_translate(_db, content: str) -> str:
        assert content == "机器学习"
        return "machine learning"

    monkeypatch.setattr(
        "app.services.discovery_topic_query.translate_to_english_for_search",
        fake_translate,
    )

    engine, session_factory = await _session(tmp_path)
    async with session_factory() as session:
        query, meta = await resolve_topic_search(session, "机器学习")

    assert meta.mode == "bilingual"
    assert "topic:machine-learning" in query
    assert "机器学习" in query
    await engine.dispose()


@pytest.mark.asyncio
async def test_discovery_topic_api_includes_search_meta(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "github_token", "test-token")

    async def fake_search(*_args, **_kwargs):
        from datetime import UTC, datetime

        from app.schemas.discovery import DiscoveryPageRead

        return DiscoveryPageRead(
            items=[],
            page=1,
            per_page=20,
            has_more=False,
            total_count=0,
            fetched_at=datetime.now(UTC),
            source="github_search",
        )

    monkeypatch.setattr(
        "app.api.discovery.fetch_search_channel_page",
        fake_search,
    )

    res = await client.get("/discovery/topic?topic=rust")
    assert res.status_code == 200
    data = res.json()
    assert data["search_meta"]["mode"] == "plain"
    assert data["search_meta"]["terms"] == ["rust"]

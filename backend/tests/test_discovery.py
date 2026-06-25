from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services.discovery_enrich import (
    _merge_enriched,
    is_rss_aggregate_description,
    pick_repo_description,
    repo_from_github_json,
    repo_from_rss_stub,
)
from app.services.discovery_search import (
    build_hot_release_query,
    build_most_popular_query,
    build_topic_query,
)
from app.services.discovery_snapshot import (
    TrendingSnapshotEntry,
    apply_trending_deltas,
    compute_trending_deltas,
)
from app.services.discovery_trending import parse_trending_rss_xml, trending_rss_url
from app.services.discovery_cache import MOST_POPULAR_FEED_TTL, TRENDING_FEED_TTL

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Trending</title>
    <item>
      <title>foo/bar</title>
      <link>https://github.com/foo/bar</link>
      <description>⭐ 1,234 | 🍴 56</description>
    </item>
    <item>
      <title>acme/demo</title>
      <link>https://github.com/acme/demo</link>
      <description>⭐ 500 | 🍴 10</description>
    </item>
  </channel>
</rss>
"""

SAMPLE_RSS_V2 = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Trending</title>
    <item>
      <title>new/repo</title>
      <link>https://github.com/new/repo</link>
      <description>⭐ 100 | 🍴 1</description>
    </item>
    <item>
      <title>foo/bar</title>
      <link>https://github.com/foo/bar</link>
      <description>⭐ 1,300 | 🍴 60</description>
    </item>
  </channel>
</rss>
"""


def test_trending_and_most_popular_ttl_one_hour():
    assert TRENDING_FEED_TTL.total_seconds() == 3600
    assert MOST_POPULAR_FEED_TTL.total_seconds() == 3600


def test_compute_trending_deltas():
    current = parse_trending_rss_xml(SAMPLE_RSS_V2)
    previous = [
        TrendingSnapshotEntry(full_name="foo/bar", rank=1, stars=1234, forks=56),
    ]
    deltas = compute_trending_deltas(current, previous)
    assert deltas["foo/bar"].stars == 66
    assert deltas["foo/bar"].forks == 4
    assert deltas["foo/bar"].rank == -1
    assert deltas["new/repo"].is_new is True
    assert deltas["new/repo"].rank is None


def test_apply_trending_deltas():
    items = parse_trending_rss_xml(SAMPLE_RSS_V2)
    previous = [TrendingSnapshotEntry(full_name="foo/bar", rank=1, stars=1234, forks=56)]
    deltas = compute_trending_deltas(items, previous)
    merged = apply_trending_deltas(items, deltas)
    foo = next(item for item in merged if item.full_name == "foo/bar")
    assert foo.delta is not None
    assert foo.delta.stars == 66


@pytest.mark.asyncio
async def test_trending_baseline_after_second_fetch(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    call = 0

    async def fake_fetch(_time_range: str) -> str:
        nonlocal call
        call += 1
        return SAMPLE_RSS if call == 1 else SAMPLE_RSS_V2

    monkeypatch.setattr(
        "app.services.discovery_trending.fetch_trending_rss_xml",
        fake_fetch,
    )

    res1 = await client.get("/discovery/trending?range=daily&fresh=true")
    assert res1.status_code == 200
    assert res1.json()["baseline_at"] is None

    res2 = await client.get("/discovery/trending?range=daily&fresh=true")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["baseline_at"] is not None
    foo = next(item for item in data2["items"] if item["full_name"] == "foo/bar")
    assert foo["delta"]["stars"] == 66
    assert foo["delta"]["rank"] == -1
    new_item = next(item for item in data2["items"] if item["full_name"] == "new/repo")
    assert new_item["delta"]["is_new"] is True


    assert trending_rss_url("weekly") == (
        "https://mshibanami.github.io/GitHubTrendingRSS/weekly/all.xml"
    )


def test_parse_trending_rss_xml():
    items = parse_trending_rss_xml(SAMPLE_RSS)
    assert len(items) == 2
    assert items[0].full_name == "foo/bar"
    assert items[0].rank == 1
    assert items[0].stars == 1234
    assert items[0].forks == 56
    assert items[0].language is None
    assert items[0].description is None
    assert items[1].full_name == "acme/demo"
    assert items[1].stars == 500


def test_is_rss_aggregate_description():
    assert is_rss_aggregate_description("Learn it. " + "▒" * 10)
    assert is_rss_aggregate_description("x" * 400)
    assert is_rss_aggregate_description("⭐ 1,234 | 🍴 56")
    assert not is_rss_aggregate_description("Short GitHub tagline")


def test_parse_trending_rss_pagination_slice():
    items = parse_trending_rss_xml(SAMPLE_RSS)
    page_size = 1
    page = 2
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]
    assert len(page_items) == 1
    assert page_items[0].full_name == "acme/demo"
    assert page_items[0].rank == 2


def test_merge_enriched_preserves_rss_stars():
    base = repo_from_rss_stub(
        rank=2,
        full_name="acme/demo",
        html_url="https://github.com/acme/demo",
        description="from rss",
        stars=500,
        forks=10,
    )
    enriched = repo_from_github_json(
        {
            "full_name": "acme/demo",
            "name": "demo",
            "html_url": "https://github.com/acme/demo",
            "stargazers_count": 999,
            "forks_count": 99,
            "language": "Rust",
            "topics": ["cli"],
            "owner": {"login": "acme", "avatar_url": "https://github.com/acme.png"},
        },
        rank=2,
    )
    merged = _merge_enriched(base, enriched)
    assert merged.stars == 500
    assert merged.forks == 10
    assert merged.language == "Rust"
    assert merged.description == "from rss"


def test_pick_repo_description_drops_rss_body():
    base = repo_from_rss_stub(
        rank=1,
        full_name="foo/bar",
        html_url="https://github.com/foo/bar",
        description="Long RSS " * 80,
        stars=100,
        forks=5,
    )
    enriched = repo_from_github_json(
        {
            "full_name": "foo/bar",
            "name": "bar",
            "html_url": "https://github.com/foo/bar",
            "description": "GitHub one-liner",
            "stargazers_count": 100,
            "owner": {"login": "foo"},
        },
        rank=1,
    )
    assert pick_repo_description(base, enriched) == "GitHub one-liner"


def test_merge_enriched_prefers_github_description():
    base = repo_from_rss_stub(
        rank=1,
        full_name="foo/bar",
        html_url="https://github.com/foo/bar",
        description="Long RSS body with README excerpt " * 50,
        stars=100,
        forks=5,
    )
    enriched = repo_from_github_json(
        {
            "full_name": "foo/bar",
            "name": "bar",
            "html_url": "https://github.com/foo/bar",
            "description": "Short GitHub tagline",
            "stargazers_count": 100,
            "forks_count": 5,
            "language": "Go",
            "owner": {"login": "foo"},
        },
        rank=1,
    )
    merged = _merge_enriched(base, enriched)
    assert merged.description == "Short GitHub tagline"


def test_merge_enriched_fills_stars_when_rss_missing():
    base = repo_from_rss_stub(
        rank=1,
        full_name="foo/bar",
        html_url="https://github.com/foo/bar",
        description="desc",
        stars=0,
        forks=0,
    )
    enriched = repo_from_github_json(
        {
            "full_name": "foo/bar",
            "name": "bar",
            "html_url": "https://github.com/foo/bar",
            "stargazers_count": 1234,
            "forks_count": 56,
            "language": "TypeScript",
            "topics": ["web"],
            "owner": {"login": "foo", "avatar_url": "https://github.com/foo.png"},
        },
        rank=1,
    )
    merged = _merge_enriched(base, enriched)
    assert merged.stars == 1234
    assert merged.forks == 56
    assert merged.language == "TypeScript"


def test_needs_github_enrich_ignores_empty_topics():
    from app.services.discovery_enrich import _needs_github_enrich

    item = repo_from_github_json(
        {
            "full_name": "foo/bar",
            "name": "bar",
            "html_url": "https://github.com/foo/bar",
            "stargazers_count": 100,
            "forks_count": 1,
            "language": "Go",
            "topics": [],
            "owner": {"login": "foo", "avatar_url": "https://github.com/foo.png"},
        },
        rank=1,
    )
    assert _needs_github_enrich(item) is False


def test_build_hot_release_query():
    q = build_hot_release_query()
    assert "stars:>10" in q
    assert "archived:false" in q
    assert "pushed:>=" in q


def test_build_most_popular_query():
    q = build_most_popular_query()
    assert "stars:>1000" in q
    assert "created:<" in q
    assert "pushed:>=" in q


def test_build_topic_query():
    assert build_topic_query("rust") == "topic:rust stars:>10 archived:false"
    assert build_topic_query("topic:python") == "topic:python stars:>10 archived:false"


@pytest.mark.asyncio
async def test_trending_api_returns_rss_without_enrich(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_fetch(_time_range: str) -> str:
        return SAMPLE_RSS

    monkeypatch.setattr(
        "app.services.discovery_trending.fetch_trending_rss_xml",
        fake_fetch,
    )

    res = await client.get("/discovery/trending?range=weekly&page=1&per_page=10")
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "rss"
    assert len(data["items"]) == 2
    assert data["items"][0]["full_name"] == "foo/bar"
    assert data["items"][0]["language"] is None


@pytest.mark.asyncio
async def test_trending_api_uses_feed_cache(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = 0

    async def fake_fetch(_time_range: str) -> str:
        nonlocal calls
        calls += 1
        return SAMPLE_RSS

    monkeypatch.setattr(
        "app.services.discovery_trending.fetch_trending_rss_xml",
        fake_fetch,
    )

    await client.get("/discovery/trending?range=weekly")
    await client.get("/discovery/trending?range=weekly")
    assert calls == 1


@pytest.mark.asyncio
async def test_repos_enrich_parallel(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "github_token", "test-token")

    async def fake_github_repo(client, base, token):  # noqa: ARG001
        owner, repo = base.full_name.split("/", 1)
        return repo_from_github_json(
            {
                "full_name": f"{owner}/{repo}",
                "name": repo,
                "html_url": f"https://github.com/{owner}/{repo}",
                "description": "demo",
                "stargazers_count": 100,
                "forks_count": 5,
                "language": "Rust",
                "topics": ["cli"],
                "owner": {"login": owner, "avatar_url": f"https://github.com/{owner}.png"},
                "pushed_at": "2026-01-01T00:00:00Z",
            },
            rank=base.rank,
        )

    monkeypatch.setattr(
        "app.services.discovery_enrich._fetch_github_repo",
        fake_github_repo,
    )

    res = await client.post(
        "/discovery/repos/enrich",
        json={
            "items": [
                {
                    "full_name": "foo/bar",
                    "rank": 1,
                    "stars": 1234,
                    "forks": 56,
                    "html_url": "https://github.com/foo/bar",
                },
                {
                    "full_name": "acme/demo",
                    "rank": 2,
                    "stars": 500,
                    "forks": 10,
                    "html_url": "https://github.com/acme/demo",
                },
            ],
        },
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 2
    assert items[0]["language"] == "Rust"
    assert items[0]["topics"] == ["cli"]
    assert items[0]["stars"] == 1234
    assert items[1]["stars"] == 500

    res2 = await client.post(
        "/discovery/repos/enrich",
        json={"items": [{"full_name": "foo/bar", "rank": 1}]},
    )
    assert res2.status_code == 200
    assert res2.json()["items"][0]["language"] == "Rust"


@pytest.mark.asyncio
async def test_discovery_repo_readme_requires_token(client: AsyncClient) -> None:
    res = await client.get("/discovery/repos/foo/bar/readme")
    assert res.status_code == 424


@pytest.mark.asyncio
async def test_discovery_repo_readme_ok(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import settings
    from app.services.github_client import ReadmeGithubResult

    monkeypatch.setattr(settings, "github_token", "test-token")

    async def fake_readme(owner: str, repo: str, token: str):  # noqa: ARG001
        return ReadmeGithubResult(content="# Hello", sha="abc", path="README.md")

    monkeypatch.setattr(
        "app.services.discovery_repo_content.fetch_readme_from_github",
        fake_readme,
    )

    res = await client.get("/discovery/repos/foo/bar/readme")
    assert res.status_code == 200
    data = res.json()
    assert data["content"] == "# Hello"
    assert data["source"] == "github"
    assert data["is_default"] is True


@pytest.mark.asyncio
async def test_discovery_repo_releases_ok(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "github_token", "test-token")

    async def fake_releases(owner: str, repo: str, token: str):  # noqa: ARG001
        return [
            {
                "tag_name": "v1.0.0",
                "name": "First",
                "body": "Notes",
                "published_at": "2026-01-01T00:00:00Z",
                "html_url": "https://github.com/foo/bar/releases/tag/v1.0.0",
                "prerelease": False,
                "draft": False,
                "assets": [],
            }
        ]

    monkeypatch.setattr(
        "app.services.discovery_repo_content.fetch_releases",
        fake_releases,
    )

    res = await client.get("/discovery/repos/foo/bar/releases")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["tag_name"] == "v1.0.0"
    assert data["source"] == "github"

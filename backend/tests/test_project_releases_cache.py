"""Release 列表数据库缓存与 fresh 同步。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services.project_github_content import _map_release_item


async def _fake_github_token(_db, _project):
    return "octocat", "Hello-World", "fake-token"


async def _create_project(client: AsyncClient) -> int:
    libs = (await client.get("/project-libraries")).json()
    lib_id = libs[0]["id"]
    res = await client.post(
        f"/project-libraries/{lib_id}/projects",
        json={
            "github_url": "https://github.com/octocat/Hello-World",
            "name": "Hello-World",
            "full_name": "octocat/Hello-World",
        },
    )
    assert res.status_code == 201
    return int(res.json()["id"])


@pytest.mark.asyncio
async def test_get_releases_returns_cache_without_github(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await _create_project(client)
    github_calls: list[str] = []

    async def _fake_fetch(*_args, **_kwargs):
        github_calls.append("fetch")
        return [
            {
                "tag_name": "v1.0.0",
                "name": "First",
                "published_at": "2026-01-01T00:00:00Z",
            }
        ]

    monkeypatch.setattr(
        "app.services.project_github_content.fetch_releases",
        _fake_fetch,
    )
    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _fake_github_token,
    )

    first = await client.get(f"/projects/{project_id}/releases")
    assert first.status_code == 200
    assert first.json()["source"] == "github"
    assert len(first.json()["items"]) == 1
    assert github_calls == ["fetch"]

    second = await client.get(f"/projects/{project_id}/releases")
    assert second.status_code == 200
    body = second.json()
    assert body["source"] == "cache"
    assert body["items"][0]["tag_name"] == "v1.0.0"
    assert github_calls == ["fetch"]


@pytest.mark.asyncio
async def test_get_releases_fresh_syncs_from_github(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await _create_project(client)
    state = {"n": 0}

    async def _fake_fetch(*_args, **_kwargs):
        state["n"] += 1
        if state["n"] == 1:
            return [{"tag_name": "v1.0.0", "published_at": "2026-01-01T00:00:00Z"}]
        return [
            {"tag_name": "v2.0.0", "published_at": "2026-02-01T00:00:00Z"},
            {"tag_name": "v1.0.0", "published_at": "2026-01-01T00:00:00Z"},
        ]

    monkeypatch.setattr(
        "app.services.project_github_content.fetch_releases",
        _fake_fetch,
    )
    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _fake_github_token,
    )

    await client.get(f"/projects/{project_id}/releases")
    fresh = await client.get(f"/projects/{project_id}/releases", params={"fresh": "true"})
    assert fresh.status_code == 200
    body = fresh.json()
    assert body["source"] == "github"
    assert len(body["items"]) == 2
    assert body["content_changed"] is True


@pytest.mark.asyncio
async def test_get_releases_cache_without_token(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await _create_project(client)

    async def _fake_fetch(*_args, **_kwargs):
        return [{"tag_name": "v1.0.0"}]

    monkeypatch.setattr(
        "app.services.project_github_content.fetch_releases",
        _fake_fetch,
    )
    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _fake_github_token,
    )

    await client.get(f"/projects/{project_id}/releases")

    async def _no_token(_db, _project):
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_424_FAILED_DEPENDENCY, detail="no token")

    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _no_token,
    )

    cached = await client.get(f"/projects/{project_id}/releases")
    assert cached.status_code == 200
    assert cached.json()["source"] == "cache"

    fresh = await client.get(f"/projects/{project_id}/releases", params={"fresh": "true"})
    assert fresh.status_code == 424


def test_releases_cache_fingerprint_changes_on_new_release() -> None:
    from app.services.project_github_content import _releases_cache_fingerprint

    v1 = [_map_release_item({"tag_name": "v1.0.0", "published_at": "2026-01-01T00:00:00Z"})]
    v2 = [
        _map_release_item({"tag_name": "v2.0.0", "published_at": "2026-02-01T00:00:00Z"}),
        _map_release_item({"tag_name": "v1.0.0", "published_at": "2026-01-01T00:00:00Z"}),
    ]
    assert v1[0] is not None and v2[0] is not None and v2[1] is not None
    fp1 = _releases_cache_fingerprint([v1[0]])
    fp2 = _releases_cache_fingerprint([v2[0], v2[1]])
    assert fp1 != fp2

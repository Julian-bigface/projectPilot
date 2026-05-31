"""默认 README 数据库缓存与 fresh 同步。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services.github_client import ReadmeGithubResult


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
async def test_get_readme_returns_cache_without_github(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await _create_project(client)
    github_calls: list[str] = []

    async def _fake_fetch(*_args, **_kwargs):
        github_calls.append("fetch")
        return ReadmeGithubResult(content="# Live\n", sha="sha-live", path="README.md")

    monkeypatch.setattr(
        "app.services.project_github_content.fetch_readme_from_github",
        _fake_fetch,
    )
    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _fake_github_token,
    )

    first = await client.get(f"/projects/{project_id}/readme")
    assert first.status_code == 200
    assert first.json()["source"] == "github"
    assert github_calls == ["fetch"]

    second = await client.get(f"/projects/{project_id}/readme")
    assert second.status_code == 200
    body = second.json()
    assert body["source"] == "cache"
    assert body["content"] == "# Live\n"
    assert github_calls == ["fetch"]


@pytest.mark.asyncio
async def test_get_readme_fresh_syncs_from_github(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await _create_project(client)
    state = {"n": 0}

    async def _fake_fetch(*_args, **_kwargs):
        state["n"] += 1
        if state["n"] == 1:
            return ReadmeGithubResult(content="# v1\n", sha="sha1", path="README.md")
        return ReadmeGithubResult(content="# v2\n", sha="sha2", path="README.md")

    monkeypatch.setattr(
        "app.services.project_github_content.fetch_readme_from_github",
        _fake_fetch,
    )
    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _fake_github_token,
    )

    await client.get(f"/projects/{project_id}/readme")
    fresh = await client.get(f"/projects/{project_id}/readme", params={"fresh": "true"})
    assert fresh.status_code == 200
    body = fresh.json()
    assert body["source"] == "github"
    assert body["content"] == "# v2\n"
    assert body["content_changed"] is True


@pytest.mark.asyncio
async def test_readme_sha_change_clears_translation(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await _create_project(client)
    state = {"n": 0}

    async def _fake_fetch(*_args, **_kwargs):
        state["n"] += 1
        if state["n"] == 1:
            return ReadmeGithubResult(content="# v1\n", sha="sha1", path="README.md")
        return ReadmeGithubResult(content="# v2\n", sha="sha2", path="README.md")

    monkeypatch.setattr(
        "app.services.project_github_content.fetch_readme_from_github",
        _fake_fetch,
    )
    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _fake_github_token,
    )

    await client.get(f"/projects/{project_id}/readme")
    patch = await client.patch(
        f"/projects/{project_id}",
        json={"readme_translated": "# 译文\n"},
    )
    assert patch.status_code == 200
    assert patch.json()["readme_translated"] == "# 译文\n"

    fresh = await client.get(f"/projects/{project_id}/readme", params={"fresh": "true"})
    assert fresh.status_code == 200

    detail = await client.get(f"/projects/{project_id}")
    assert detail.json()["readme_translated"] is None


@pytest.mark.asyncio
async def test_get_readme_cache_without_token(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await _create_project(client)

    async def _fake_fetch(*_args, **_kwargs):
        return ReadmeGithubResult(content="# Cached\n", sha="sha1", path="README.md")

    monkeypatch.setattr(
        "app.services.project_github_content.fetch_readme_from_github",
        _fake_fetch,
    )
    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _fake_github_token,
    )

    await client.get(f"/projects/{project_id}/readme")

    async def _no_token(_db, _project):
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_424_FAILED_DEPENDENCY, detail="no token")

    monkeypatch.setattr(
        "app.services.project_github_content._resolve_owner_repo_token",
        _no_token,
    )

    cached = await client.get(f"/projects/{project_id}/readme")
    assert cached.status_code == 200
    assert cached.json()["source"] == "cache"

    fresh = await client.get(f"/projects/{project_id}/readme", params={"fresh": "true"})
    assert fresh.status_code == 424

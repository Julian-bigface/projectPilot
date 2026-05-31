"""README 按路径拉取与路径校验。"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.services.readme_path import normalize_repo_markdown_path


def test_normalize_repo_markdown_path_ok() -> None:
    assert normalize_repo_markdown_path("README.zh-CN.md") == "README.zh-CN.md"
    assert normalize_repo_markdown_path("/docs/cn.md") == "docs/cn.md"
    assert normalize_repo_markdown_path("docs/../README.md") == "README.md"


def test_normalize_rejects_traversal() -> None:
    with pytest.raises(HTTPException) as exc:
        normalize_repo_markdown_path("../../etc/passwd.md")
    assert exc.value.status_code == 400


def test_normalize_rejects_non_md() -> None:
    with pytest.raises(HTTPException) as exc:
        normalize_repo_markdown_path("package.json")
    assert exc.value.status_code == 400


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
async def test_get_readme_default_and_by_path(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await _create_project(client)
    calls: list[str] = []

    async def _fake_fetch_readme(_db, _project, *, path: str | None = None, fresh: bool = False):
        from app.schemas.project_github import ProjectReadmeRead

        if path:
            calls.append(f"path:{path}")
            return ProjectReadmeRead(
                content=f"# {path}\n",
                path=path,
                is_default=False,
                source="github",
            )
        calls.append("default")
        return ProjectReadmeRead(content="# Default\n", path=None, is_default=True, source="github")

    monkeypatch.setattr("app.api.projects.fetch_project_readme", _fake_fetch_readme)

    default_res = await client.get(f"/projects/{project_id}/readme")
    assert default_res.status_code == 200
    body = default_res.json()
    assert body["is_default"] is True
    assert body["content"] == "# Default\n"

    zh_res = await client.get(
        f"/projects/{project_id}/readme",
        params={"path": "README.zh-CN.md"},
    )
    assert zh_res.status_code == 200
    zh_body = zh_res.json()
    assert zh_body["is_default"] is False
    assert zh_body["path"] == "README.zh-CN.md"
    assert calls == ["default", "path:README.zh-CN.md"]


@pytest.mark.asyncio
async def test_get_readme_invalid_path(client: AsyncClient) -> None:
    project_id = await _create_project(client)
    res = await client.get(
        f"/projects/{project_id}/readme",
        params={"path": "package.json"},
    )
    assert res.status_code == 400

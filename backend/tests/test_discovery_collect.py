"""发现中心取消收藏 API 测试。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


async def _create_library_and_project(client: AsyncClient) -> tuple[int, int]:
    lib_res = await client.post("/project-libraries", json={"name": "CollectLib"})
    assert lib_res.status_code == 201
    lib_id = lib_res.json()["id"]
    proj_res = await client.post(
        f"/project-libraries/{lib_id}/projects",
        json={
            "github_url": "https://github.com/octocat/Hello-World",
            "name": "Hello-World",
            "full_name": "octocat/Hello-World",
            "description": "A test repo",
            "stars": 100,
        },
    )
    assert proj_res.status_code == 201
    return lib_id, proj_res.json()["id"]


@pytest.mark.asyncio
async def test_remove_project_collect_skips_trash(client: AsyncClient) -> None:
    _lib_id, project_id = await _create_library_and_project(client)

    res = await client.delete(f"/projects/{project_id}/collect")
    assert res.status_code == 204

    get_res = await client.get(f"/projects/{project_id}")
    assert get_res.status_code == 404

    list_res = await client.get("/projects?_start=0&_end=50&deleted_only=true")
    assert list_res.status_code == 200
    deleted_ids = {item["id"] for item in list_res.json()}
    assert project_id not in deleted_ids

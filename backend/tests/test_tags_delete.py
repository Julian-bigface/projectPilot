"""标签删除：解除项目/文件夹关联后删除标签定义。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_delete_tag_clears_project_links(client: AsyncClient) -> None:
    lib_res = await client.post("/project-libraries", json={"name": "TagDeleteLib"})
    assert lib_res.status_code == 201
    lib_id = lib_res.json()["id"]

    tag_res = await client.post(
        f"/project-libraries/{lib_id}/tags",
        json={"name": "to-delete"},
    )
    assert tag_res.status_code == 201
    tag_id = tag_res.json()["id"]

    proj_res = await client.post(
        f"/project-libraries/{lib_id}/projects",
        json={
            "github_url": "https://github.com/a/b",
            "name": "proj",
            "full_name": "a/b",
        },
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    patch_res = await client.patch(
        f"/projects/{project_id}",
        json={"tag_ids": [tag_id]},
    )
    assert patch_res.status_code == 200
    assert any(t["id"] == tag_id for t in patch_res.json()["tags"])

    del_res = await client.delete(f"/project-libraries/{lib_id}/tags/{tag_id}")
    assert del_res.status_code == 204

    get_res = await client.get(f"/projects/{project_id}")
    assert get_res.status_code == 200
    assert all(t["id"] != tag_id for t in get_res.json()["tags"])

    tags_res = await client.get(f"/project-libraries/{lib_id}/tags")
    assert tags_res.status_code == 200
    assert tag_id not in [t["id"] for t in tags_res.json()]

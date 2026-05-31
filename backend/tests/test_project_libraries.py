"""项目库 API 与库内隔离。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_project_libraries_crud_and_scoped_tree(client: AsyncClient) -> None:
    list_res = await client.get("/project-libraries")
    assert list_res.status_code == 200
    libs = list_res.json()
    assert len(libs) >= 1
    default_id = libs[0]["id"]

    create_res = await client.post(
        "/project-libraries",
        json={"name": "测试库 B", "description": "简介"},
    )
    assert create_res.status_code == 201
    lib_b = create_res.json()
    assert lib_b["name"] == "测试库 B"

    folder_a = await client.post(
        f"/project-libraries/{default_id}/folders",
        json={"name": "库A文件夹", "parent_id": None},
    )
    assert folder_a.status_code == 201

    folder_b = await client.post(
        f"/project-libraries/{lib_b['id']}/folders",
        json={"name": "库B文件夹", "parent_id": None},
    )
    assert folder_b.status_code == 201

    flat_a = await client.get(f"/project-libraries/{default_id}/folders")
    flat_b = await client.get(f"/project-libraries/{lib_b['id']}/folders")
    assert len(flat_a.json()) == 1
    assert flat_b.json()[0]["name"] == "库B文件夹"
    assert flat_a.json()[0]["name"] == "库A文件夹"

    tree_b = await client.get(f"/project-libraries/{lib_b['id']}/library/tree")
    assert tree_b.status_code == 200
    assert tree_b.json()["folders"][0]["name"] == "库B文件夹"

    patch_res = await client.patch(
        f"/project-libraries/{lib_b['id']}",
        json={"is_pinned": True},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_pinned"] is True

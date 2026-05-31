"""文件夹子树导入/导出包。"""

from __future__ import annotations

import json

import pytest
from httpx import AsyncClient


async def _default_library_id(client: AsyncClient) -> int:
    libs = (await client.get("/project-libraries")).json()
    return int(libs[0]["id"])


@pytest.mark.asyncio
async def test_export_subtree_structure(client: AsyncClient) -> None:
    lib_id = await _default_library_id(client)
    root = await client.post(
        f"/project-libraries/{lib_id}/folders",
        json={"name": "ExportRoot", "parent_id": None},
    )
    assert root.status_code == 201
    root_id = root.json()["id"]
    child = await client.post(
        f"/project-libraries/{lib_id}/folders",
        json={"name": "Child", "parent_id": root_id},
    )
    assert child.status_code == 201
    child_id = child.json()["id"]

    await client.post(
        f"/project-libraries/{lib_id}/projects",
        json={
            "github_url": "https://github.com/a/b",
            "name": "proj",
            "full_name": "a/b",
            "folder_id": child_id,
        },
    )

    export_res = await client.get(
        f"/project-libraries/{lib_id}/folders/{root_id}/export"
    )
    assert export_res.status_code == 200
    bundle = json.loads(export_res.text)
    assert bundle["format_version"] == 1
    assert bundle["kind"] == "project_pilot.folder_bundle"
    assert len(bundle["folders"]) == 2
    keys = {f["key"] for f in bundle["folders"]}
    assert f"f{root_id}" in keys
    assert f"f{child_id}" in keys
    root_spec = next(f for f in bundle["folders"] if f["key"] == f"f{root_id}")
    assert root_spec["parent_key"] is None
    child_spec = next(f for f in bundle["folders"] if f["key"] == f"f{child_id}")
    assert child_spec["parent_key"] == f"f{root_id}"
    assert len(bundle["projects"]) == 1
    assert bundle["projects"][0]["folder_key"] == f"f{child_id}"


@pytest.mark.asyncio
async def test_import_to_empty_library_at_root(client: AsyncClient) -> None:
    lib_id = await _default_library_id(client)
    root = await client.post(
        f"/project-libraries/{lib_id}/folders",
        json={"name": "Src", "parent_id": None},
    )
    root_id = root.json()["id"]
    export_res = await client.get(
        f"/project-libraries/{lib_id}/folders/{root_id}/export"
    )
    bundle = json.loads(export_res.text)

    target_lib = await client.post("/project-libraries", json={"name": "ImportTarget"})
    target_id = target_lib.json()["id"]

    imp = await client.post(
        f"/project-libraries/{target_id}/import/folder-bundle",
        json={"bundle": bundle, "target_parent_folder_id": None},
    )
    assert imp.status_code == 200
    body = imp.json()
    assert body["created_folders"] == 1
    tree = await client.get(f"/project-libraries/{target_id}/library/tree")
    assert tree.json()["folders"][0]["name"] == "Src"


@pytest.mark.asyncio
async def test_import_under_parent_and_duplicate_github(client: AsyncClient) -> None:
    lib_id = await _default_library_id(client)
    parent = await client.post(
        f"/project-libraries/{lib_id}/folders",
        json={"name": "Parent", "parent_id": None},
    )
    parent_id = parent.json()["id"]
    sub = await client.post(
        f"/project-libraries/{lib_id}/folders",
        json={"name": "Sub", "parent_id": parent_id},
    )
    sub_id = sub.json()["id"]
    url = "https://github.com/dup/repo"
    await client.post(
        f"/project-libraries/{lib_id}/projects",
        json={
            "github_url": url,
            "name": "one",
            "full_name": "dup/repo",
            "folder_id": sub_id,
        },
    )
    export_res = await client.get(
        f"/project-libraries/{lib_id}/folders/{sub_id}/export"
    )
    bundle = json.loads(export_res.text)

    imp_skip = await client.post(
        f"/project-libraries/{lib_id}/import/folder-bundle",
        json={
            "bundle": bundle,
            "target_parent_folder_id": parent_id,
            "skip_duplicate_github_url": True,
        },
    )
    assert imp_skip.json()["created_projects"] == 0
    assert imp_skip.json()["skipped_projects"] == 1

    imp_new = await client.post(
        f"/project-libraries/{lib_id}/import/folder-bundle",
        json={
            "bundle": bundle,
            "target_parent_folder_id": parent_id,
            "skip_duplicate_github_url": False,
        },
    )
    assert imp_new.json()["created_projects"] == 1

    projects = await client.get(f"/project-libraries/{lib_id}/projects")
    dup_count = sum(1 for p in projects.json() if p["github_url"] == url)
    assert dup_count >= 2


@pytest.mark.asyncio
async def test_export_chinese_folder_name(client: AsyncClient) -> None:
    lib_id = await _default_library_id(client)
    root = await client.post(
        f"/project-libraries/{lib_id}/folders",
        json={"name": "我的文件夹", "parent_id": None},
    )
    assert root.status_code == 201
    root_id = root.json()["id"]
    export_res = await client.get(
        f"/project-libraries/{lib_id}/folders/{root_id}/export"
    )
    assert export_res.status_code == 200
    disp = export_res.headers.get("content-disposition", "")
    assert "filename*=" in disp or "attachment" in disp
    bundle = json.loads(export_res.text)
    assert bundle["source"]["root_folder_name"] == "我的文件夹"


@pytest.mark.asyncio
async def test_import_invalid_format_and_cross_library_parent(client: AsyncClient) -> None:
    lib_id = await _default_library_id(client)
    other = await client.post("/project-libraries", json={"name": "Other"})
    other_id = other.json()["id"]
    folder_other = await client.post(
        f"/project-libraries/{other_id}/folders",
        json={"name": "X", "parent_id": None},
    )
    other_folder_id = folder_other.json()["id"]

    bad = await client.post(
        f"/project-libraries/{lib_id}/import/folder-bundle",
        json={
            "bundle": {
                "format_version": 99,
                "kind": "project_pilot.folder_bundle",
                "exported_at": "2026-01-01T00:00:00Z",
                "source": {"library_name": "a", "root_folder_name": "b"},
                "folders": [],
                "projects": [],
            },
            "target_parent_folder_id": None,
        },
    )
    assert bad.status_code == 422

    export_res = await client.get(
        f"/project-libraries/{lib_id}/folders/99999/export"
    )
    assert export_res.status_code == 404

    bundle = {
        "format_version": 1,
        "kind": "project_pilot.folder_bundle",
        "exported_at": "2026-01-01T00:00:00Z",
        "source": {"library_name": "a", "root_folder_name": "b"},
        "folders": [
            {
                "key": "f1",
                "parent_key": None,
                "name": "Imported",
                "sort_order": 0,
                "tags": [],
            }
        ],
        "projects": [],
    }
    cross = await client.post(
        f"/project-libraries/{lib_id}/import/folder-bundle",
        json={"bundle": bundle, "target_parent_folder_id": other_folder_id},
    )
    assert cross.status_code == 400

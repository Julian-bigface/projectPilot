"""GitHub topics 同步为库内 Tag。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_project_topics_sync_into_same_library(client: AsyncClient) -> None:
    lib_res = await client.post("/project-libraries", json={"name": "TopicsLib"})
    assert lib_res.status_code == 201
    lib_id = lib_res.json()["id"]

    proj_res = await client.post(
        f"/project-libraries/{lib_id}/projects",
        json={
            "github_url": "https://github.com/o/r",
            "name": "r",
            "full_name": "o/r",
            "state": "未体验",
            "topics": ["bilibili", "cli"],
        },
    )
    assert proj_res.status_code == 201

    tags_res = await client.get(f"/project-libraries/{lib_id}/tags")
    assert tags_res.status_code == 200
    names = {t["name"] for t in tags_res.json()}
    assert {"bilibili", "cli"} <= names


@pytest.mark.asyncio
async def test_topics_sync_does_not_reuse_other_library_tag(client: AsyncClient) -> None:
    lib_a = (await client.post("/project-libraries", json={"name": "LibA"})).json()["id"]
    lib_b = (await client.post("/project-libraries", json={"name": "LibB"})).json()["id"]

    tag_a = (
        await client.post(
            f"/project-libraries/{lib_a}/tags",
            json={"name": "shared-topic"},
        )
    ).json()

    proj_b = (
        await client.post(
            f"/project-libraries/{lib_b}/projects",
            json={
                "github_url": "https://github.com/o/b",
                "name": "b",
                "full_name": "o/b",
                "state": "未体验",
                "topics": ["shared-topic"],
            },
        )
    ).json()
    tag_ids_b = {t["id"] for t in proj_b["tags"]}
    assert tag_a["id"] not in tag_ids_b

    tags_b = (await client.get(f"/project-libraries/{lib_b}/tags")).json()
    shared_in_b = [t for t in tags_b if t["name"] == "shared-topic"]
    assert len(shared_in_b) == 1
    assert shared_in_b[0]["id"] != tag_a["id"]
    assert shared_in_b[0]["id"] in tag_ids_b

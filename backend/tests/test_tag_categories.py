"""标签分类 CRUD 测试。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_delete_category_moves_tags_to_uncategorized(client: AsyncClient) -> None:
    lib_res = await client.post("/project-libraries", json={"name": "CatDeleteLib"})
    assert lib_res.status_code == 201
    lib_id = lib_res.json()["id"]

    cat_res = await client.post(
        f"/project-libraries/{lib_id}/tag-categories",
        json={"name": "Frontend"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    tag_res = await client.post(
        f"/project-libraries/{lib_id}/tags",
        json={"name": "react", "category_id": cat_id},
    )
    assert tag_res.status_code == 201
    tag_id = tag_res.json()["id"]

    del_res = await client.delete(f"/project-libraries/{lib_id}/tag-categories/{cat_id}")
    assert del_res.status_code == 204

    uncategorized = await client.get(
        f"/project-libraries/{lib_id}/tags",
        params={"uncategorized": "true"},
    )
    assert uncategorized.status_code == 200
    ids = [t["id"] for t in uncategorized.json()]
    assert tag_id in ids

    tag_get = await client.get(f"/project-libraries/{lib_id}/tags")
    row = next(t for t in tag_get.json() if t["id"] == tag_id)
    assert row["category_id"] is None
    assert row["category_name"] is None

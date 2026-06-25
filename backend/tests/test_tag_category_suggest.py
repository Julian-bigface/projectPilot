"""标签 AI 分类 API 测试。"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.tag_ai import TagCategoryProposal
from app.services.tag_category_suggest import (
    _CategoryRow,
    _TagRow,
    _coarsen_new_category_name,
    _parse_llm_json,
    _validate_proposal,
)


def test_coarsen_ai_subcategories() -> None:
    assert _coarsen_new_category_name("AI基础") == "AI"
    assert _coarsen_new_category_name("AI编程") == "AI"
    assert _coarsen_new_category_name("AI工具") == "AI"
    assert _coarsen_new_category_name("大模型") == "AI"


def test_parse_llm_json_ignores_trailing_json() -> None:
    raw = (
        '{"proposals":[{"tag_id":1,"tag_name":"a","category_id":2,"confidence":"high"}]}\n'
        '{"noise": true}'
    )
    parsed = _parse_llm_json(raw)
    assert len(parsed.proposals) == 1
    assert parsed.proposals[0].tag_id == 1


def test_parse_llm_json_strips_markdown_fence() -> None:
    raw = """```json
{"proposals":[{"tag_id":1,"tag_name":"x","category_id":null,"new_category_name":"AI","confidence":"medium"}]}
```"""
    parsed = _parse_llm_json(raw)
    assert parsed.proposals[0].new_category_name == "AI"


def test_validate_proposal_maps_fine_ai_to_existing_category() -> None:
    categories = [_CategoryRow(id=7, name="AI")]
    tag_by_id = {1: _TagRow(id=1, name="langchain")}
    proposal = TagCategoryProposal(
        tag_id=1,
        tag_name="langchain",
        category_id=None,
        new_category_name="AI编程",
        confidence="high",
    )
    validated = _validate_proposal(
        proposal,
        tag_by_id=tag_by_id,
        valid_category_ids={7},
        include_new_categories=True,
        categories=categories,
    )
    assert validated is not None
    assert validated.category_id == 7
    assert validated.new_category_name is None


async def _seed_library_with_tags(client: AsyncClient) -> tuple[int, int, int]:
    lib_res = await client.post("/project-libraries", json={"name": "TagAiTestLib"})
    assert lib_res.status_code == 201
    lib_id = lib_res.json()["id"]

    cat_res = await client.post(
        f"/project-libraries/{lib_id}/tag-categories",
        json={"name": "DevTools"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    tag_res = await client.post(
        f"/project-libraries/{lib_id}/tags",
        json={"name": "docker"},
    )
    assert tag_res.status_code == 201
    tag_id = tag_res.json()["id"]

    return lib_id, cat_id, tag_id


@pytest.mark.asyncio
async def test_suggest_without_api_key_returns_424(client: AsyncClient) -> None:
    lib_id, _, _ = await _seed_library_with_tags(client)
    res = await client.post(
        f"/project-libraries/{lib_id}/tags/suggest-categories",
        json={},
    )
    assert res.status_code == 424
    assert "API Key" in res.json()["detail"]


@pytest.mark.asyncio
async def test_suggest_maps_tags_to_categories(client: AsyncClient) -> None:
    lib_id, cat_id, tag_id = await _seed_library_with_tags(client)
    await client.put("/settings/ai", json={"api_key": "sk-test"})

    proposals = [
        TagCategoryProposal(
            tag_id=tag_id,
            tag_name="docker",
            category_id=cat_id,
            confidence="high",
            reason="容器工具",
        )
    ]

    with patch(
        "app.services.tag_category_suggest._call_llm_batch",
        new=AsyncMock(return_value=proposals),
    ):
        res = await client.post(
            f"/project-libraries/{lib_id}/tags/suggest-categories",
            json={},
        )

    assert res.status_code == 200
    data = res.json()
    assert data["batches"] == 1
    assert len(data["proposals"]) == 1
    assert data["proposals"][0]["tag_id"] == tag_id
    assert data["proposals"][0]["category_id"] == cat_id
    assert data["proposals"][0]["confidence"] == "high"


@pytest.mark.asyncio
async def test_suggest_stream_ndjson(client: AsyncClient) -> None:
    lib_id, cat_id, tag_id = await _seed_library_with_tags(client)
    await client.put("/settings/ai", json={"api_key": "sk-test"})

    proposals = [
        TagCategoryProposal(
            tag_id=tag_id,
            tag_name="docker",
            category_id=cat_id,
            confidence="high",
        )
    ]

    with patch(
        "app.services.tag_category_suggest._call_llm_batch",
        new=AsyncMock(return_value=proposals),
    ):
        async with client.stream(
            "POST",
            f"/project-libraries/{lib_id}/tags/suggest-categories/stream",
            json={},
        ) as res:
            assert res.status_code == 200
            events = []
            async for line in res.aiter_lines():
                if line.strip():
                    events.append(json.loads(line))

    assert events[0]["event"] == "start"
    assert events[1]["event"] == "batch_start"
    assert events[2]["event"] == "batch"
    assert events[-1]["event"] == "done"
    assert events[-1]["proposal_count"] == 1
    assert events[2]["proposals"][0]["tag_id"] == tag_id


@pytest.mark.asyncio
async def test_suggest_no_categories_without_new_flag_returns_400(client: AsyncClient) -> None:
    lib_res = await client.post("/project-libraries", json={"name": "EmptyCatLib"})
    lib_id = lib_res.json()["id"]
    await client.post(f"/project-libraries/{lib_id}/tags", json={"name": "solo-tag"})
    await client.put("/settings/ai", json={"api_key": "sk-test"})

    res = await client.post(
        f"/project-libraries/{lib_id}/tags/suggest-categories",
        json={"include_new_categories": False},
    )
    assert res.status_code == 400
    assert "分类" in res.json()["detail"]


@pytest.mark.asyncio
async def test_apply_updates_tag_category(client: AsyncClient) -> None:
    lib_id, cat_id, tag_id = await _seed_library_with_tags(client)

    apply_res = await client.post(
        f"/project-libraries/{lib_id}/tags/apply-category-suggestions",
        json={"items": [{"tag_id": tag_id, "category_id": cat_id}]},
    )
    assert apply_res.status_code == 200
    data = apply_res.json()
    assert data["applied"] == 1
    assert data["skipped"] == 0

    tags_res = await client.get(f"/project-libraries/{lib_id}/tags?uncategorized=true")
    assert all(t["id"] != tag_id for t in tags_res.json())

    tag_get = await client.get(f"/project-libraries/{lib_id}/tags")
    updated = next(t for t in tag_get.json() if t["id"] == tag_id)
    assert updated["category_id"] == cat_id
    assert updated["category_name"] == "DevTools"


@pytest.mark.asyncio
async def test_apply_creates_new_category(client: AsyncClient) -> None:
    lib_id, _, tag_id = await _seed_library_with_tags(client)

    apply_res = await client.post(
        f"/project-libraries/{lib_id}/tags/apply-category-suggestions",
        json={
            "items": [
                {
                    "tag_id": tag_id,
                    "category_id": None,
                    "new_category_name": "Infrastructure",
                }
            ]
        },
    )
    assert apply_res.status_code == 200
    assert apply_res.json()["applied"] == 1
    assert apply_res.json()["categories_created"] == 1

    cats = (await client.get(f"/project-libraries/{lib_id}/tag-categories")).json()
    assert any(c["name"] == "Infrastructure" for c in cats)


@pytest.mark.asyncio
async def test_apply_invalid_category_skipped(client: AsyncClient) -> None:
    lib_id, _, tag_id = await _seed_library_with_tags(client)

    apply_res = await client.post(
        f"/project-libraries/{lib_id}/tags/apply-category-suggestions",
        json={"items": [{"tag_id": tag_id, "category_id": 99999}]},
    )
    assert apply_res.status_code == 200
    data = apply_res.json()
    assert data["applied"] == 0
    assert data["skipped"] == 1
    assert data["errors"]

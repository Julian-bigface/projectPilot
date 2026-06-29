"""封面风格 AI 调整版本历史测试。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cover_style_revision import (
    CoverStyleRevisionSnapshot,
    create_revision_after_ai_refine,
    get_revision,
    list_revisions,
)
from app.services.cover_style_presets import ColorTokens, FontTokens
from app.services.cover_style_store import create_style
from app.services.readme_cover_storage import (
    cover_absolute_path,
    save_style_example_png,
    style_revision_example_relative_path,
)
from tests.conftest import make_test_cover_png
from tests.test_content_factory import _create_library_and_project


def _revision_payload(*, instruction: str = "调亮配色", prompt_prefix: str = "1242x1660") -> dict:
    return {
        "instruction": instruction,
        "prompt_prefix": prompt_prefix,
        "prompt_template": "Cover for {project_name}",
        "negative_prompt": "bad text",
        "color_tokens": {},
        "font_tokens": {},
        "style_report": "测试报告",
    }


@pytest.mark.asyncio
async def test_create_list_get_revision_via_api(
    client: AsyncClient, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )

    lib_id, _ = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"

    create_res = await client.post(
        f"{base}/cover-styles",
        json={
            "label": "版本测试风格",
            "prompt_prefix": "1242x1660 vertical",
            "prompt_template": "{project_name}",
            "negative_prompt": "blur",
        },
    )
    assert create_res.status_code == 201
    style_id = create_res.json()["id"]

    example_path = save_style_example_png(
        make_test_cover_png(), style_id=style_id, force=True
    )
    assert cover_absolute_path(example_path).is_file()

    post_res = await client.post(
        f"{base}/cover-styles/{style_id}/revisions",
        json=_revision_payload(instruction="第一次 AI 调整"),
    )
    assert post_res.status_code == 201
    created = post_res.json()
    revision_id = created["id"]
    assert created["revision_index"] == 1
    assert created["source"] == "ai_refine"
    assert created["instruction"] == "第一次 AI 调整"
    assert created["example_image_url"]

    list_res = await client.get(f"{base}/cover-styles/{style_id}/revisions")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == revision_id
    assert items[0]["example_image_url"]

    get_res = await client.get(
        f"{base}/cover-styles/{style_id}/revisions/{revision_id}"
    )
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["prompt_prefix"] == "1242x1660"
    assert detail["style_report"] == "测试报告"

    example_res = await client.get(
        f"{base}/cover-styles/{style_id}/revisions/{revision_id}/example"
    )
    assert example_res.status_code == 200
    assert example_res.headers["content-type"].startswith("image/")

    rev_relative = style_revision_example_relative_path(
        style_id=style_id, revision_id=revision_id
    )
    assert cover_absolute_path(rev_relative).is_file()


@pytest.mark.asyncio
async def test_delete_revision_via_api(
    client: AsyncClient, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )

    lib_id, _ = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"

    create_res = await client.post(
        f"{base}/cover-styles",
        json={
            "label": "删除版本测试",
            "prompt_prefix": "1242x1660 vertical",
            "prompt_template": "{project_name}",
            "negative_prompt": "blur",
        },
    )
    assert create_res.status_code == 201
    style_id = create_res.json()["id"]

    save_style_example_png(make_test_cover_png(), style_id=style_id, force=True)

    post_res = await client.post(
        f"{base}/cover-styles/{style_id}/revisions",
        json=_revision_payload(),
    )
    assert post_res.status_code == 201
    revision_id = post_res.json()["id"]
    rev_relative = style_revision_example_relative_path(
        style_id=style_id, revision_id=revision_id
    )
    assert cover_absolute_path(rev_relative).is_file()

    del_res = await client.delete(
        f"{base}/cover-styles/{style_id}/revisions/{revision_id}"
    )
    assert del_res.status_code == 204

    list_res = await client.get(f"{base}/cover-styles/{style_id}/revisions")
    assert list_res.status_code == 200
    assert list_res.json()["items"] == []
    assert not cover_absolute_path(rev_relative).is_file()


@pytest.mark.asyncio
async def test_revision_prunes_oldest_over_limit(db_session: AsyncSession, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )

    library_id = 1
    style_id = "manual-rev-prune-ab12cd"
    await create_style(
        db_session,
        library_id=library_id,
        style_id=style_id,
        label="裁剪测试",
        source="manual",
        prompt_prefix="prefix",
        prompt_template="template",
        negative_prompt="bad",
    )
    save_style_example_png(make_test_cover_png(), style_id=style_id, force=True)
    await db_session.commit()

    snapshot = CoverStyleRevisionSnapshot(
        design_analysis=None,
        prompt_prefix="p",
        prompt_template="t",
        negative_prompt="n",
        color_tokens=ColorTokens(),
        font_tokens=FontTokens(),
        style_report=None,
    )

    for i in range(21):
        await create_revision_after_ai_refine(
            db_session,
            library_id=library_id,
            style_id=style_id,
            instruction=f"rev-{i}",
            snapshot=snapshot,
        )
        await db_session.commit()

    rows = await list_revisions(db_session, style_id=style_id)
    assert len(rows) == 20
    indices = sorted(row.revision_index for row in rows)
    assert indices == list(range(2, 22))

    oldest = await get_revision(db_session, style_id=style_id, revision_id=1)
    assert oldest is None

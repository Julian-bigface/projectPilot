"""cover_style_store 与 registry 单元测试。"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cover_style_registry import list_resolved_styles, resolve_style
from app.services.cover_style_store import (
    CoverStyleStoreError,
    count_styles_referencing_asset_path,
    create_style,
    delete_style,
    generate_style_id,
    set_builtin_hidden,
    slugify_style_id_part,
)


def test_slugify_style_id_part_ascii() -> None:
    assert slugify_style_id_part("极简科技") == "style"
    assert slugify_style_id_part("Cyber Mag") == "cyber-mag"


def test_generate_style_id_prefix() -> None:
    sid = generate_style_id(prefix="manual", label="Test Style")
    assert sid.startswith("manual-test-style-")


@pytest.mark.asyncio
async def test_create_and_resolve_custom_style(db_session: AsyncSession) -> None:
    library_id = 1
    style_id = "manual-test-ab12cd"
    await create_style(
        db_session,
        library_id=library_id,
        style_id=style_id,
        label="测试风格",
        source="manual",
        prompt_prefix="prefix",
        prompt_template="template {project_name}",
        negative_prompt="bad",
    )
    await db_session.commit()

    resolved = await resolve_style(db_session, library_id=library_id, style_id=style_id)
    assert resolved is not None
    assert resolved.preset.label == "测试风格"
    assert resolved.is_deletable is True


@pytest.mark.asyncio
async def test_hide_builtin_style(db_session: AsyncSession) -> None:
    library_id = 1
    await set_builtin_hidden(
        db_session, library_id=library_id, style_id="minimal-tech", hidden=True
    )
    await db_session.commit()

    items = await list_resolved_styles(db_session, library_id=library_id)
    ids = {item.preset.id for item in items}
    assert "minimal-tech" not in ids

    hidden_resolved = await resolve_style(
        db_session, library_id=library_id, style_id="minimal-tech"
    )
    assert hidden_resolved is not None
    assert hidden_resolved.hidden is True


@pytest.mark.asyncio
async def test_delete_custom_style(db_session: AsyncSession) -> None:
    library_id = 1
    style_id = "manual-del-ef34gh"
    await create_style(
        db_session,
        library_id=library_id,
        style_id=style_id,
        label="待删",
        source="manual",
        prompt_prefix="p",
        prompt_template="t {project_name}",
        negative_prompt="n",
    )
    await db_session.commit()

    row = await delete_style(db_session, library_id=library_id, style_id=style_id)
    assert row is not None
    await db_session.commit()

    assert await resolve_style(db_session, library_id=library_id, style_id=style_id) is None


@pytest.mark.asyncio
async def test_builtin_style_example_path_from_disk(
    db_session: AsyncSession, tmp_path, monkeypatch
) -> None:
    from tests.conftest import make_test_cover_png

    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    from app.services.readme_cover_storage import save_style_example_png

    library_id = 1
    style_id = "minimal-tech"
    save_style_example_png(
        make_test_cover_png(),
        library_id=library_id,
        style_id=style_id,
        force=True,
    )

    resolved = await resolve_style(db_session, library_id=library_id, style_id=style_id)
    assert resolved is not None
    assert resolved.is_builtin is True
    assert resolved.example_image_path is not None
    assert resolved.example_image_path.endswith("example.png")


@pytest.mark.asyncio
async def test_custom_style_visible_across_libraries(db_session: AsyncSession) -> None:
    style_id = "manual-global-ab12cd"
    await create_style(
        db_session,
        library_id=1,
        style_id=style_id,
        label="全局风格",
        source="manual",
        prompt_prefix="prefix",
        prompt_template="template {project_name}",
        negative_prompt="bad",
    )
    await db_session.commit()

    in_lib_1 = await list_resolved_styles(db_session, library_id=1)
    in_lib_2 = await list_resolved_styles(db_session, library_id=2)
    assert style_id in {item.preset.id for item in in_lib_1}
    assert style_id in {item.preset.id for item in in_lib_2}


@pytest.mark.asyncio
async def test_cannot_delete_builtin(db_session: AsyncSession) -> None:
    with pytest.raises(CoverStyleStoreError):
        await delete_style(db_session, library_id=1, style_id="minimal-tech")


@pytest.mark.asyncio
async def test_count_styles_referencing_shared_asset_path(db_session: AsyncSession) -> None:
    shared_path = "_shared/styles/manual-src-ab12cd/example.png"
    await create_style(
        db_session,
        library_id=1,
        style_id="manual-src-ab12cd",
        label="源",
        source="manual",
        prompt_prefix="p",
        prompt_template="t {project_name}",
        negative_prompt="n",
        example_image_path=shared_path,
    )
    await create_style(
        db_session,
        library_id=1,
        style_id="manual-fork-cd34ef",
        label="副本",
        source="manual",
        prompt_prefix="p",
        prompt_template="t {project_name}",
        negative_prompt="n",
        fork_from_style_id="manual-src-ab12cd",
        example_image_path=shared_path,
    )
    await db_session.commit()

    assert (
        await count_styles_referencing_asset_path(
            db_session, path=shared_path, exclude_style_id="manual-fork-cd34ef"
        )
        == 1
    )
    assert (
        await count_styles_referencing_asset_path(
            db_session, path=shared_path, exclude_style_id="manual-src-ab12cd"
        )
        == 1
    )

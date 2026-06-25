"""内容工厂草稿 CRUD 与文案生成测试。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import make_test_cover_png


async def _create_library_and_project(client: AsyncClient) -> tuple[int, int]:
    lib_res = await client.post("/project-libraries", json={"name": "CFLib"})
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
async def test_content_factory_draft_crud(client: AsyncClient) -> None:
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"

    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    assert create_res.status_code == 201
    draft = create_res.json()
    draft_id = draft["id"]
    assert draft["platform"] == "xiaohongshu"
    assert draft["title"] == "Hello-World 推荐稿"
    assert draft["project"]["full_name"] == "octocat/Hello-World"

    list_res = await client.get(f"{base}/drafts")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    patch_res = await client.patch(
        f"{base}/drafts/{draft_id}",
        json={"body": "edited body", "step": 3},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["body"] == "edited body"
    assert patch_res.json()["step"] == 3

    del_res = await client.delete(f"{base}/drafts/{draft_id}")
    assert del_res.status_code == 204

    get_res = await client.get(f"{base}/drafts/{draft_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_generate_copy_preview_and_save(client: AsyncClient) -> None:
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"

    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "twitter"},
    )
    draft_id = create_res.json()["id"]

    mock_copy = {
        "title_options": ["Title A", "Title B"],
        "body": "Great project for devs.",
        "hashtags": ["#OpenSource"],
        "highlight_tags": ["CLI", "AI"],
        "hook": "Must try",
        "cover_texts": ["Cover 1"],
        "cta": "Star it",
    }

    with patch(
        "app.api.content_factory.generate_single_project_copy",
        new_callable=AsyncMock,
    ) as mock_gen:
        from app.schemas.content_factory import ContentFactoryCopyJson

        copy_obj = ContentFactoryCopyJson.model_validate(mock_copy)

        async def _preview_side_effect(
            db,
            *,
            draft,
            project,
            preview_only=False,
            platform=None,
            from_source=False,
            regenerate=False,
        ):
            if preview_only:
                return copy_obj, None
            draft.body = copy_obj.body
            draft.body_json = copy_obj.model_dump()
            draft.title = copy_obj.title_options[0]
            draft.status = "generated"
            draft.step = 2
            await db.commit()
            await db.refresh(draft)
            return copy_obj, draft

        mock_gen.side_effect = _preview_side_effect

        preview_res = await client.post(
            f"{base}/drafts/{draft_id}/generate-copy",
            json={"preview_only": True},
        )
        assert preview_res.status_code == 200
        data = preview_res.json()
        assert data["preview_only"] is True
        assert data["draft"] is None
        assert data["generated_copy"]["body"] == "Great project for devs."

        save_res = await client.post(
            f"{base}/drafts/{draft_id}/generate-copy",
            json={"preview_only": False},
        )
        assert save_res.status_code == 200
        saved = save_res.json()
        assert saved["draft"]["status"] == "generated"
        assert saved["draft"]["body"] == "Great project for devs."


@pytest.mark.asyncio
async def test_optimize_selection(client: AsyncClient) -> None:
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"

    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    draft_id = create_res.json()["id"]
    await client.patch(
        f"{base}/drafts/{draft_id}",
        json={"body": "这是原始段落，需要润色。"},
    )

    with patch(
        "app.api.content_factory.optimize_selected_copy",
        new_callable=AsyncMock,
        return_value="这是优化后的段落，表达更顺畅。",
    ):
        res = await client.post(
            f"{base}/drafts/{draft_id}/optimize-selection",
            json={
                "selected_text": "原始段落",
                "full_body": "这是原始段落，需要润色。",
            },
        )
    assert res.status_code == 200
    assert res.json()["optimized_text"] == "这是优化后的段落，表达更顺畅。"


@pytest.mark.asyncio
async def test_layout_from_source_requires_source_body(client: AsyncClient) -> None:
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    draft_id = create_res.json()["id"]

    from app.services.llm.provider import LlmError

    with patch(
        "app.api.content_factory.generate_single_project_copy",
        new_callable=AsyncMock,
        side_effect=LlmError("请先在「原文」中填写正文，再进行平台排版。"),
    ):
        res = await client.post(
            f"{base}/drafts/{draft_id}/generate-copy",
            json={"from_source": True, "platform": "wechat"},
        )
    assert res.status_code == 424
    assert "原文" in res.json()["detail"]


@pytest.mark.asyncio
async def test_upload_cover_native_readme(client: AsyncClient, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    draft_id = create_res.json()["id"]
    png_bytes = make_test_cover_png()

    res = await client.post(
        f"{base}/drafts/{draft_id}/upload-cover",
        data={"readme_sha": "deadbeef", "force": "false"},
        files={"file": ("cover.png", png_bytes, "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["cached"] is False
    assert f"/drafts/{draft_id}/cover" in data["cover_url"]
    assert "style_id=native-readme" in data["cover_url"]
    body_json = data["draft"]["body_json"]
    relative = body_json["cover_image_path"]
    assert "Hello-World_native-readme_3x4_deadbeef.png" in relative
    assert body_json["image_template"] == "native-readme"
    assert "native-readme::xiaohongshu-34" in body_json.get("cover_variants", {})
    assert (tmp_path / relative).is_file()


@pytest.mark.asyncio
async def test_generate_copy_no_api_key(client: AsyncClient) -> None:
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id},
    )
    draft_id = create_res.json()["id"]

    from app.services.llm.provider import LlmError

    with patch(
        "app.api.content_factory.generate_single_project_copy",
        new_callable=AsyncMock,
        side_effect=LlmError("未配置 API Key"),
    ):
        res = await client.post(
            f"{base}/drafts/{draft_id}/generate-copy",
            json={},
        )
    assert res.status_code == 424
    assert "API Key" in res.json()["detail"]


@pytest.mark.asyncio
async def test_list_cover_styles(client: AsyncClient) -> None:
    lib_id, _project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    res = await client.get(f"{base}/cover-styles")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 5
    ids = {item["id"] for item in items}
    assert "minimal-tech" in ids
    assert all(item["source"] == "builtin" for item in items)


@pytest.mark.asyncio
async def test_generate_ai_cover_no_key(client: AsyncClient) -> None:
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    draft_id = create_res.json()["id"]

    res = await client.post(
        f"{base}/drafts/{draft_id}/generate-ai-cover",
        json={"style_id": "minimal-tech", "size_preset_id": "xiaohongshu-34"},
    )
    assert res.status_code == 424
    assert "生图 API Key" in res.json()["detail"]


@pytest.mark.asyncio
async def test_generate_ai_cover_success(client: AsyncClient, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    draft_id = create_res.json()["id"]
    png_bytes = make_test_cover_png()

    await client.put(
        "/settings/ai/config",
        json={
            "providers": [
                {
                    "id": "default",
                    "name": "RootFlow",
                    "preset_id": "rootflowai-image",
                    "base_url": "https://api.rootflowai.com/v1",
                    "models": ["gemini-2.5-flash-image"],
                    "default_model": "gemini-2.5-flash-image",
                    "api_key": "sk-test-image",
                }
            ],
            "default_provider_id": "default",
            "scenarios": {
                "tag_classification": {"provider_id": "default", "model": "gemini-2.5-flash-image"},
                "recommend_copy": {"provider_id": "default", "model": "gemini-2.5-flash-image"},
                "recommend_image": {
                    "provider_id": "default",
                    "model": "gemini-2.5-flash-image",
                },
            },
        },
    )

    with patch(
        "app.api.content_factory.generate_image_bytes",
        new_callable=AsyncMock,
        return_value=png_bytes,
    ):
        res = await client.post(
            f"{base}/drafts/{draft_id}/generate-ai-cover",
            json={
                "style_id": "minimal-tech",
                "size_preset_id": "xiaohongshu-34",
                "force": True,
            },
        )

    assert res.status_code == 200
    data = res.json()
    body_json = data["draft"]["body_json"]
    assert body_json["cover_source"] == "ai_generated"
    assert body_json["cover_style_id"] == "minimal-tech"
    assert body_json["image_template"] == "minimal-tech"
    assert "Hello-World_minimal-tech_3x4_" in body_json["cover_image_path"]
    assert "minimal-tech::xiaohongshu-34" in body_json.get("cover_variants", {})
    assert (tmp_path / body_json["cover_image_path"]).is_file()


@pytest.mark.asyncio
async def test_generate_ai_cover_keeps_multiple_style_variants(
    client: AsyncClient, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    draft_id = create_res.json()["id"]
    png_bytes = make_test_cover_png()

    await client.put(
        "/settings/ai/config",
        json={
            "providers": [
                {
                    "id": "default",
                    "name": "RootFlow",
                    "preset_id": "rootflowai-image",
                    "base_url": "https://api.rootflowai.com/v1",
                    "models": ["gemini-2.5-flash-image"],
                    "default_model": "gemini-2.5-flash-image",
                    "api_key": "sk-test-image",
                }
            ],
            "default_provider_id": "default",
            "scenarios": {
                "recommend_image": {
                    "provider_id": "default",
                    "model": "gemini-2.5-flash-image",
                },
            },
        },
    )

    with patch(
        "app.api.content_factory.generate_image_bytes",
        new_callable=AsyncMock,
        return_value=png_bytes,
    ):
        first = await client.post(
            f"{base}/drafts/{draft_id}/generate-ai-cover",
            json={
                "style_id": "minimal-tech",
                "size_preset_id": "xiaohongshu-34",
                "force": True,
            },
        )
        second = await client.post(
            f"{base}/drafts/{draft_id}/generate-ai-cover",
            json={
                "style_id": "black-gold",
                "size_preset_id": "xiaohongshu-34",
                "force": True,
            },
        )

    assert first.status_code == 200
    assert second.status_code == 200
    variants = second.json()["draft"]["body_json"]["cover_variants"]
    assert "minimal-tech::xiaohongshu-34" in variants
    assert "black-gold::xiaohongshu-34" in variants
    assert variants["minimal-tech::xiaohongshu-34"]["cover_image_path"] != (
        variants["black-gold::xiaohongshu-34"]["cover_image_path"]
    )
    get_minimal = await client.get(
        f"{base}/drafts/{draft_id}/cover?style_id=minimal-tech&size_preset_id=xiaohongshu-34"
    )
    get_black = await client.get(
        f"{base}/drafts/{draft_id}/cover?style_id=black-gold&size_preset_id=xiaohongshu-34"
    )
    assert get_minimal.status_code == 200
    assert get_black.status_code == 200
    assert (tmp_path / variants["minimal-tech::xiaohongshu-34"]["cover_image_path"]).is_file()
    assert (tmp_path / variants["black-gold::xiaohongshu-34"]["cover_image_path"]).is_file()


@pytest.mark.asyncio
async def test_reveal_cover_opens_folder(client: AsyncClient, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    draft_id = create_res.json()["id"]
    png = make_test_cover_png()
    upload = await client.post(
        f"{base}/drafts/{draft_id}/upload-cover",
        data={"readme_sha": "abc12345", "force": "true"},
        files={"file": ("cover.png", png, "image/png")},
    )
    assert upload.status_code == 200

    with patch("app.api.content_factory.reveal_file_in_folder") as mock_reveal:
        res = await client.post(
            f"{base}/drafts/{draft_id}/reveal-cover?style_id=native-readme&size_preset_id=xiaohongshu-34"
        )
    assert res.status_code == 200
    data = res.json()
    assert "absolute_path" in data
    assert "directory" in data
    mock_reveal.assert_called_once()


@pytest.mark.asyncio
async def test_cover_style_manual_crud(client: AsyncClient) -> None:
    lib_id, _project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"

    create_res = await client.post(
        f"{base}/cover-styles",
        json={
            "label": "我的风格",
            "prompt_prefix": "1242x1660, 3:4 vertical portrait",
            "prompt_template": "Cover for {project_name}: {headline}",
            "negative_prompt": "bad text",
        },
    )
    assert create_res.status_code == 201
    style = create_res.json()
    style_id = style["id"]
    assert style["source"] == "manual"
    assert style["is_deletable"] is True

    list_res = await client.get(f"{base}/cover-styles")
    assert list_res.status_code == 200
    ids = {item["id"] for item in list_res.json()["items"]}
    assert style_id in ids

    fork_res = await client.post(
        f"{base}/cover-styles/{style_id}/fork",
        json={"label": "我的风格副本"},
    )
    assert fork_res.status_code == 201
    forked_id = fork_res.json()["id"]
    assert fork_res.json()["fork_from_style_id"] == style_id

    del_res = await client.delete(f"{base}/cover-styles/{style_id}")
    assert del_res.status_code == 204

    del_fork = await client.delete(f"{base}/cover-styles/{forked_id}")
    assert del_fork.status_code == 204


@pytest.mark.asyncio
async def test_fork_delete_preserves_source_style_assets(
    client: AsyncClient, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    from app.services.readme_cover_storage import (
        archive_style_reference,
        cover_absolute_path,
        save_style_example_png,
    )

    lib_id, _ = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"

    create_res = await client.post(
        f"{base}/cover-styles",
        json={
            "label": "带图风格",
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
    reference_path = archive_style_reference(
        make_test_cover_png(), style_id=style_id
    )
    assert cover_absolute_path(example_path).is_file()
    assert cover_absolute_path(reference_path).is_file()

    fork_res = await client.post(
        f"{base}/cover-styles/{style_id}/fork",
        json={"label": "带图风格副本"},
    )
    assert fork_res.status_code == 201
    forked = fork_res.json()
    forked_id = forked["id"]
    assert forked["example_image_url"]
    assert forked["reference_image_url"]

    del_fork = await client.delete(f"{base}/cover-styles/{forked_id}")
    assert del_fork.status_code == 204

    assert cover_absolute_path(example_path).is_file()
    assert cover_absolute_path(reference_path).is_file()

    get_res = await client.get(f"{base}/cover-styles")
    assert get_res.status_code == 200
    source = next(item for item in get_res.json()["items"] if item["id"] == style_id)
    assert source["example_image_url"]
    assert source["reference_image_url"]

    example_res = await client.get(f"{base}/cover-styles/{style_id}/example")
    assert example_res.status_code == 200
    reference_res = await client.get(f"{base}/cover-styles/{style_id}/reference")
    assert reference_res.status_code == 200


@pytest.mark.asyncio
async def test_generate_ai_cover_custom_style(client: AsyncClient, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    lib_id, project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"

    style_res = await client.post(
        f"{base}/cover-styles",
        json={
            "style_id": "manual-custom-ab12cd",
            "label": "Custom",
            "prompt_prefix": "1242x1660 vertical",
            "prompt_template": "{project_name} {headline}",
            "negative_prompt": "blur",
        },
    )
    assert style_res.status_code == 201

    create_res = await client.post(
        f"{base}/drafts",
        json={"project_id": project_id, "platform": "xiaohongshu"},
    )
    draft_id = create_res.json()["id"]
    png_bytes = make_test_cover_png()

    await client.put(
        "/settings/ai/config",
        json={
            "providers": [
                {
                    "id": "default",
                    "name": "RootFlow",
                    "preset_id": "rootflowai-image",
                    "base_url": "https://api.rootflowai.com/v1",
                    "models": ["gemini-2.5-flash-image"],
                    "default_model": "gemini-2.5-flash-image",
                    "api_key": "sk-test-image",
                }
            ],
            "default_provider_id": "default",
            "scenarios": {
                "recommend_image": {
                    "provider_id": "default",
                    "model": "gemini-2.5-flash-image",
                },
            },
        },
    )

    with patch(
        "app.api.content_factory.generate_image_bytes",
        new_callable=AsyncMock,
        return_value=png_bytes,
    ):
        res = await client.post(
            f"{base}/drafts/{draft_id}/generate-ai-cover",
            json={
                "style_id": "manual-custom-ab12cd",
                "size_preset_id": "xiaohongshu-34",
                "force": True,
            },
        )

    assert res.status_code == 200
    body_json = res.json()["draft"]["body_json"]
    assert body_json["cover_style_source"] == "manual"
    assert body_json["cover_style_id"] == "manual-custom-ab12cd"


@pytest.mark.asyncio
async def test_builtin_style_example_url_after_preview_file(
    client: AsyncClient, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    lib_id, _project_id = await _create_library_and_project(client)
    base = f"/project-libraries/{lib_id}/content-factory"
    style_id = "minimal-tech"

    from app.services.readme_cover_storage import save_style_example_png

    save_style_example_png(
        make_test_cover_png(),
        library_id=lib_id,
        style_id=style_id,
        force=True,
    )

    list_res = await client.get(f"{base}/cover-styles")
    assert list_res.status_code == 200
    item = next(i for i in list_res.json()["items"] if i["id"] == style_id)
    assert item["example_image_url"] is not None
    assert style_id in item["example_image_url"]

    get_res = await client.get(f"{base}/cover-styles/{style_id}/example")
    assert get_res.status_code == 200
    assert get_res.headers["content-type"].startswith("image/png")

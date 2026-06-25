"""cover_variants 单元测试。"""

from pathlib import Path

from app.services.cover_variants import (
    cover_variant_key,
    get_cover_variant,
    merge_body_json_cover_variants,
    resolve_cover_path_for_request,
    slugify_cover_filename_part,
    upsert_cover_variant,
)
from app.services.readme_cover_storage import find_newest_draft_cover_file


def test_cover_variant_key() -> None:
    assert cover_variant_key("minimal-tech", "xiaohongshu-34") == (
        "minimal-tech::xiaohongshu-34"
    )


def test_slugify_cover_filename_part() -> None:
    assert slugify_cover_filename_part("Hello World!") == "Hello-World"


def test_upsert_and_get_cover_variant() -> None:
    record = {
        "cover_image_path": "1/2/Proj_minimal-tech_3x4_abc.png",
        "cover_source": "ai_generated",
        "cover_style_id": "minimal-tech",
        "cover_size_preset_id": "xiaohongshu-34",
        "cover_prompt_hash": "abc",
    }
    merged = upsert_cover_variant(
        {},
        style_id="minimal-tech",
        size_preset_id="xiaohongshu-34",
        record=record,
    )
    found = get_cover_variant(merged, style_id="minimal-tech", size_preset_id="xiaohongshu-34")
    assert found is not None
    assert found["cover_image_path"] == record["cover_image_path"]
    assert get_cover_variant(merged, style_id="black-gold", size_preset_id="xiaohongshu-34") is None


def test_merge_body_json_cover_variants_keeps_server_variants() -> None:
    existing = {
        "image_template": "ai-style-new",
        "cover_variants": {
            "ai-style-new::xiaohongshu-34": {
                "cover_image_path": "2/14/RedBox_ai-style-new_3x4_abc.png",
                "cover_source": "ai_generated",
            }
        },
    }
    stale_patch = {
        "image_template": "ai-style-new",
        "cover_variants": {},
    }
    merged = merge_body_json_cover_variants(existing, stale_patch)
    assert "ai-style-new::xiaohongshu-34" in merged["cover_variants"]


def test_resolve_cover_path_does_not_use_other_style_legacy_path(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    draft_dir = tmp_path / "2" / "14"
    draft_dir.mkdir(parents=True)
    minimal_png = draft_dir / "RedBox_minimal-tech_3x4_abc.png"
    minimal_png.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)

    body = {
        "image_template": "minimal-tech",
        "cover_image_path": "2/14/RedBox_minimal-tech_3x4_abc.png",
        "cover_source": "ai_generated",
        "cover_style_id": "minimal-tech",
    }
    relative = resolve_cover_path_for_request(
        body,
        style_id="black-gold",
        size_preset_id="xiaohongshu-34",
        library_id=2,
        draft_id=14,
    )
    assert relative is None


def test_resolve_cover_path_falls_back_to_disk(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    draft_dir = tmp_path / "2" / "14"
    draft_dir.mkdir(parents=True)
    png = draft_dir / "RedBox_ai-style-cb5683_3x4_63c403af.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)

    relative = resolve_cover_path_for_request(
        {"image_template": "ai-style-cb5683"},
        style_id="ai-style-cb5683",
        size_preset_id="xiaohongshu-34",
        library_id=2,
        draft_id=14,
    )
    assert relative == "2/14/RedBox_ai-style-cb5683_3x4_63c403af.png"


def test_find_newest_draft_cover_file(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    draft_dir = tmp_path / "2" / "14"
    draft_dir.mkdir(parents=True)
    older = draft_dir / "RedBox_ai-style-cb5683_3x4_aaaa1111.png"
    newer = draft_dir / "RedBox_ai-style-cb5683_3x4_bbbb2222.png"
    older.write_bytes(b"old")
    newer.write_bytes(b"new")

    found = find_newest_draft_cover_file(
        library_id=2,
        draft_id=14,
        style_id="ai-style-cb5683",
        size_preset_id="xiaohongshu-34",
    )
    assert found == "2/14/RedBox_ai-style-cb5683_3x4_bbbb2222.png"

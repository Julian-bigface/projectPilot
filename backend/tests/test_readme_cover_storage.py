"""README 封面存储辅助逻辑测试。"""

import pytest

from app.services.readme_cover_storage import (
    ReadmeCoverError,
    build_cover_filename,
    save_ai_cover_png,
    save_cover_png,
    validate_cover_png,
)
from tests.conftest import make_test_cover_png

_PNG = make_test_cover_png()


def test_build_cover_filename_includes_project_style_ratio() -> None:
    name = build_cover_filename(
        project_name="Hello World",
        style_id="minimal-tech",
        size_preset_id="xiaohongshu-34",
        unique_suffix="abc12345",
    )
    assert name == "Hello-World_minimal-tech_3x4_abc12345.png"


def test_validate_cover_png_rejects_non_png() -> None:
    with pytest.raises(ReadmeCoverError, match="PNG"):
        validate_cover_png(b"not-a-png")


def test_save_cover_png_writes_named_file(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    relative, cached = save_cover_png(
        _PNG,
        library_id=1,
        draft_id=2,
        project_name="My-Project",
        size_preset_id="xiaohongshu-34",
        readme_sha="deadbeef",
    )
    assert cached is False
    assert relative.endswith("My-Project_native-readme_3x4_deadbeef.png")
    assert (tmp_path / relative).is_file()


def test_save_cover_png_force_creates_new_timestamp_file(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    first, _ = save_cover_png(
        _PNG,
        library_id=1,
        draft_id=2,
        project_name="My-Project",
        size_preset_id="xiaohongshu-34",
        readme_sha="deadbeef",
    )
    second, cached = save_cover_png(
        _PNG,
        library_id=1,
        draft_id=2,
        project_name="My-Project",
        size_preset_id="xiaohongshu-34",
        readme_sha="deadbeef",
        force=True,
        existing_readme_sha="deadbeef",
        existing_cover_path=first,
    )
    assert cached is False
    assert second != first
    assert (tmp_path / first).is_file()
    assert (tmp_path / second).is_file()


def test_save_ai_cover_png_uses_cache(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    relative, cached = save_ai_cover_png(
        _PNG,
        library_id=1,
        draft_id=2,
        project_name="Repo",
        style_id="minimal-tech",
        size_preset_id="xiaohongshu-34",
        prompt_hash="abcd1234ef567890",
    )
    assert cached is False
    again, cached2 = save_ai_cover_png(
        _PNG,
        library_id=1,
        draft_id=2,
        project_name="Repo",
        style_id="minimal-tech",
        size_preset_id="xiaohongshu-34",
        prompt_hash="abcd1234ef567890",
        existing_prompt_hash="abcd1234ef567890",
        existing_cover_path=relative,
    )
    assert cached2 is True
    assert again == relative

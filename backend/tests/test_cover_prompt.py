"""cover_prompt 单元测试。"""

from __future__ import annotations

from app.models.project import Project
from app.services.cover_prompt import apply_size_preset_to_prompt_prefix, build_cover_prompt


def _project() -> Project:
    return Project(
        id=1,
        project_library_id=1,
        name="Hello-World",
        full_name="octocat/Hello-World",
        description="A test repo",
        stars=100,
        language="Python",
        github_url="https://github.com/octocat/Hello-World",
    )


def test_build_cover_prompt_includes_hook() -> None:
    built = build_cover_prompt(
        style_id="minimal-tech",
        project=_project(),
        body_json={
            "hook": "一键部署开源项目",
            "cover_texts": ["Star 100+", "Python"],
            "highlight_tags": ["devtools"],
        },
    )
    assert "一键部署开源项目" in built.image_prompt
    assert built.prompt_hash
    assert built.style.id == "minimal-tech"


def test_build_cover_prompt_unknown_style() -> None:
    import pytest

    from app.services.cover_prompt import CoverPromptError

    with pytest.raises(CoverPromptError):
        build_cover_prompt(style_id="unknown", project=_project(), body_json={})


def test_build_cover_prompt_unwraps_unknown_braces() -> None:
    from app.services.cover_style_presets import CoverStylePreset

    style = CoverStylePreset(
        id="test-braces",
        label="Test",
        prompt_prefix="1242x1660 vertical",
        prompt_template=(
            "Palette uses {accent blue} with headline「{headline}」for {project_name}."
        ),
        negative_prompt="blur",
    )
    built = build_cover_prompt(
        style_id="test-braces",
        project=_project(),
        body_json={"hook": "一键部署"},
        style=style,
    )
    assert "accent blue" in built.image_prompt
    assert "{accent blue}" not in built.image_prompt
    assert "一键部署" in built.image_prompt
    assert "Hello-World" in built.image_prompt


def test_apply_size_preset_replaces_baked_in_dimensions() -> None:
    prefix = (
        "1242x1660, 3:4 vertical portrait cover, strict margins；"
        "极简编辑式 + Notion/Linear 文档气质，专业理性"
    )
    adapted = apply_size_preset_to_prompt_prefix(prefix, "square-11")
    assert adapted.startswith("1080x1080, 1:1 square cover, strict margins；")
    assert "极简编辑式" in adapted
    assert "1242x1660" not in adapted
    assert "3:4" not in adapted


def test_build_cover_prompt_uses_selected_size_preset() -> None:
    built = build_cover_prompt(
        style_id="minimal-tech",
        project=_project(),
        body_json={"hook": "测试标题"},
        size_preset_id="wide-169",
    )
    assert "1920x1080, 16:9 horizontal landscape cover" in built.image_prompt
    assert "1242x1660" not in built.image_prompt


def test_build_cover_prompt_without_size_keeps_style_prefix() -> None:
    built = build_cover_prompt(
        style_id="minimal-tech",
        project=_project(),
        body_json={"hook": "测试标题"},
    )
    assert "1242x1660" in built.image_prompt

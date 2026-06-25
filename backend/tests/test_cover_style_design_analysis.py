"""design_analysis 格式化与出图 prompt 注入测试。"""

from app.services.cover_style_design_analysis import (
    CoverStyleDesignAnalysis,
    ColorStrategy,
    LayoutSystem,
    TypographyStrategy,
    design_analysis_has_content,
    format_design_analysis_for_image_prompt,
)
from app.services.cover_style_presets import ColorTokens, CoverStylePreset, FontTokens
from app.services.cover_prompt import build_cover_prompt


def test_design_analysis_has_content_detects_nonempty() -> None:
    empty = CoverStyleDesignAnalysis()
    assert design_analysis_has_content(empty) is False
    filled = CoverStyleDesignAnalysis(design_system="Editorial", unique_memory_point="blue arrow bar")
    assert design_analysis_has_content(filled) is True


def test_format_design_analysis_for_image_prompt() -> None:
    analysis = CoverStyleDesignAnalysis(
        design_system="Bento",
        layout_system=LayoutSystem(structure="2x2 card grid", alignment="left aligned"),
        visual_components=["pill tags", "thin divider lines"],
        unique_memory_point="pastel cards with numeric corner badges",
    )
    text = format_design_analysis_for_image_prompt(analysis)
    assert "Bento" in text
    assert "2x2 card grid" in text
    assert "pastel cards" in text


def test_build_cover_prompt_includes_design_analysis() -> None:
    style = CoverStylePreset(
        id="test",
        label="Test",
        prompt_prefix="1242x1660 vertical",
        prompt_template="Cover for {project_name}: {headline}",
        negative_prompt="blur",
        design_analysis=CoverStyleDesignAnalysis(
            design_system="Swiss",
            unique_memory_point="bold left stripe",
        ),
    )

    class _Project:
        name = "Demo"
        description = "desc"
        language = "Python"
        stars = 10

    built = build_cover_prompt(style_id="test", project=_Project(), body_json={}, style=style)
    assert "Swiss" in built.image_prompt
    assert "bold left stripe" in built.image_prompt

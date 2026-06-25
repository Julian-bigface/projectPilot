"""cover_style_presets 单元测试。"""

from app.services.cover_style_presets import get_builtin_style, list_builtin_styles


def test_list_builtin_styles_count() -> None:
    styles = list_builtin_styles()
    assert len(styles) == 5
    assert all(s.source == "builtin" for s in styles)


def test_get_builtin_style_minimal_tech() -> None:
    style = get_builtin_style("minimal-tech")
    assert style is not None
    assert style.label == "极简科技"
    assert style.font_tokens.heading == "sans"

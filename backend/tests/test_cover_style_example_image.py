"""风格示例图 prompt 覆盖测试。"""

from __future__ import annotations

from app.services.cover_style_example_image import apply_style_prompt_override
from app.services.cover_style_presets import get_builtin_style


def test_apply_style_prompt_override_merges_fields() -> None:
    preset = get_builtin_style("minimal-tech")
    assert preset is not None
    merged = apply_style_prompt_override(
        preset,
        prompt_prefix="999x999 custom prefix",
        prompt_template="Custom {project_name}",
        negative_prompt="no blur",
    )
    assert merged.prompt_prefix == "999x999 custom prefix"
    assert merged.prompt_template == "Custom {project_name}"
    assert merged.negative_prompt == "no blur"
    assert merged.id == preset.id

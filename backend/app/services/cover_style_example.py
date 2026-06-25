"""内容工厂 — 风格示例图 prompt（generic 占位项目）。"""

from __future__ import annotations

from app.models.project import Project
from app.services.cover_prompt import BuiltCoverPrompt, build_cover_prompt
from app.services.cover_style_presets import CoverStylePreset

_EXAMPLE_BODY_JSON = {
    "hook": "开源工具示例 · Vibe Coding",
    "cover_texts": ["一键部署", "Star 10k+", "开发者必备"],
    "highlight_tags": ["open source", "devtools", "AI"],
}


def _example_project() -> Project:
    return Project(
        id=0,
        project_library_id=0,
        name="ExampleProject",
        full_name="demo/example-project",
        description="An example open-source project for style preview.",
        stars=10240,
        language="TypeScript",
        github_url="https://github.com/demo/example-project",
    )


def build_style_example_prompt(*, style: CoverStylePreset) -> BuiltCoverPrompt:
    """用固定占位项目生成风格示例图 prompt。"""
    return build_cover_prompt(
        style_id=style.id,
        project=_example_project(),
        body_json=_EXAMPLE_BODY_JSON,
        style=style,
    )

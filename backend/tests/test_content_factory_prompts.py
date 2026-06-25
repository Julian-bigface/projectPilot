"""内容工厂 Prompt 路由测试。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.llm.provider import LlmProvider


class _FakeProvider(LlmProvider):
    def __init__(self) -> None:
        self.last_user = ""

    async def complete(self, *, system: str, user: str, **kwargs: object) -> str:
        self.last_user = user
        return (
            '{"title_options":["T1"],"body":"正文","hashtags":[],"highlight_tags":[],'
            '"hook":"h","cover_texts":[],"cta":"c"}'
        )


@pytest.mark.asyncio
async def test_regenerate_uses_target_platform_in_prompt(client) -> None:
    from app.models.content_factory_draft import ContentFactoryDraft
    from app.models.project import Project
    from app.services.content_factory_copy import generate_single_project_copy

    draft = ContentFactoryDraft(
        id=1,
        project_library_id=1,
        project_id=1,
        platform="xiaohongshu",
        body_json={
            "source_title": "原文标题",
            "source_body": "这是偏口语的原文内容。",
        },
    )
    project = Project(
        id=1,
        project_library_id=1,
        name="Demo",
        full_name="octocat/demo",
        description="desc",
        stars=1,
    )
    fake = _FakeProvider()

    with patch(
        "app.services.content_factory_copy._get_llm",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        await generate_single_project_copy(
            object(),  # db unused due to mocks
            draft=draft,
            project=project,
            platform="wechat",
            from_source=True,
            regenerate=True,
            preview_only=True,
        )

    assert "目标平台：微信公众号" in fake.last_user
    assert "平台风格要求" in fake.last_user
    assert "这是一次「重新生成全文」任务" in fake.last_user
    assert "不要沿用原文在其他平台下的语气" in fake.last_user

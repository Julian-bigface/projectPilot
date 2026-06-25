"""翻译服务与 API 单元测试（Mock Provider，不依赖 Google 网络）。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services.translation.markdown_translate import (
    block_needs_translation,
    join_markdown_display_blocks,
    list_markdown_display_blocks,
    split_markdown_segments,
    translate_markdown,
    translate_markdown_block,
    translate_plain_text,
)
from app.services.translation.provider import TranslationError


class _MockProvider:
    def __init__(self, prefix: str = "[T]") -> None:
        self.prefix = prefix
        self.calls: list[tuple[str, str, str]] = []

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        self.calls.append((text, source_lang, target_lang))
        if not text.strip():
            return text
        return f"{self.prefix}{text}"


def test_split_markdown_segments_empty() -> None:
    assert split_markdown_segments("") == []


def test_split_markdown_segments_preserves_code_block() -> None:
    md = "Hello\n\n```python\nprint('x')\n```\n\nWorld"
    segments = split_markdown_segments(md)
    assert len(segments) == 3
    assert segments[0] == ("Hello\n\n", False)
    assert segments[1][1] is True
    assert "print('x')" in segments[1][0]
    assert segments[2] == ("\n\nWorld", False)


def test_translate_markdown_skips_code() -> None:
    provider = _MockProvider()
    md = "Title\n\n```js\nconst x = 1\n```\n\nFooter"
    out = translate_markdown(provider, md, "auto", "zh-CN")
    assert "[T]Title" in out
    assert "Footer" in out
    assert "```js" in out
    assert "[T]const x = 1" not in out


def test_translate_markdown_preserves_html_tags() -> None:
    provider = _MockProvider()
    md = (
        '<p align="right">English | 中文</p>\n'
        '<h1 align="center">OpsKat</h1>\n'
        '<p align="center">Manage servers with AI.</p>'
    )
    out = translate_markdown(provider, md, "auto", "zh-CN")
    assert '<p align="right">' in out
    assert '<h1 align="center">' in out
    assert '<p align="center">' in out
    assert "对齐" not in out
    assert "\uE000" not in out
    assert "[T]" in out
    for call_text, _, _ in provider.calls:
        assert "<p" not in call_text
        assert "<h1" not in call_text


def test_translate_markdown_preserves_inline_code() -> None:
    provider = _MockProvider()
    md = "Use `align=center` in config.\n\nNormal text."
    out = translate_markdown(provider, md, "auto", "zh-CN")
    assert "`align=center`" in out
    assert "[T]" in out


def test_translate_markdown_unwraps_html_fence() -> None:
    provider = _MockProvider()
    md = (
        "Intro paragraph.\n\n"
        "```html\n"
        '<a href="https://example.com"><img src="./screenshot.png" alt="Screenshot" /></a>\n'
        "```\n\n"
        "Footer text."
    )
    out = translate_markdown(provider, md, "auto", "zh-CN")
    assert "```" not in out
    assert '<a href="https://example.com">' in out
    assert 'src="./screenshot.png"' in out
    assert "[T]Intro paragraph." in out
    assert "[T]\n\nFooter text." in out
    for call_text, _, _ in provider.calls:
        assert "```" not in call_text


def test_translate_markdown_keeps_python_fence() -> None:
    provider = _MockProvider()
    md = "```python\nprint('x')\n```"
    out = translate_markdown(provider, md, "auto", "zh-CN")
    assert "```python" in out
    assert "print('x')" in out
    assert not provider.calls


def test_list_markdown_display_blocks_splits_paragraphs() -> None:
    md = "First para.\n\nSecond para.\n\n```python\nx = 1\n```\n\nThird."
    blocks = list_markdown_display_blocks(md)
    assert blocks == ["First para.", "Second para.", "```python\nx = 1\n```", "Third."]


def test_block_needs_translation_skips_code_fence() -> None:
    assert not block_needs_translation("```js\nconst a = 1\n```")
    assert block_needs_translation("Hello world")


def test_translate_markdown_block_code_unchanged() -> None:
    provider = _MockProvider()
    block = "```python\nprint(1)\n```"
    assert translate_markdown_block(provider, block, "auto", "zh-CN") == block
    assert not provider.calls


def test_join_markdown_display_blocks() -> None:
    assert join_markdown_display_blocks(["a", "b"]) == "a\n\nb"


def test_translate_preserves_markdown_links_with_inline_code() -> None:
    provider = _MockProvider()
    block = (
        "- [`/grill-me`](./skills/productivity/grill-me/SKILL.md) - for non-code uses\n"
        "- [`/grill-with-docs`](./skills/engineering/grill-with-docs/SKILL.md) - same"
    )
    out = translate_markdown_block(provider, block, "auto", "zh-CN")
    assert "[`/grill-me`](./skills/productivity/grill-me/SKILL.md)" in out
    assert "[`/grill-with-docs`](./skills/engineering/grill-with-docs/SKILL.md)" in out
    for call_text, _, _ in provider.calls:
        assert call_text.strip() not in {"- [", "- ["}
        assert not call_text.strip().startswith("](./")
        assert "[`/grill-me`]" not in call_text


def test_iter_translatable_runs_keeps_markdown_link_intact() -> None:
    from app.services.translation.markdown_translate import _iter_translatable_runs

    line = "- [`/grill-me`](./skills/x/SKILL.md) - for non-code uses"
    pieces = list(_iter_translatable_runs(line))
    preserved = [p for p, keep in pieces if not keep]
    assert any("[`/grill-me`](./skills/x/SKILL.md)" in p for p in preserved)
    assert not any(p.strip() == "- [" for p, t in pieces if t)


def test_should_skip_mt_fragment_list_marker() -> None:
    from app.services.translation.markdown_translate import _should_skip_mt_fragment

    assert _should_skip_mt_fragment("- ")
    assert _should_skip_mt_fragment(" - ")
    assert not _should_skip_mt_fragment(" - for non-code uses")


def test_translate_plain_text_empty_raises() -> None:
    provider = _MockProvider()
    with pytest.raises(TranslationError):
        translate_plain_text(provider, "   ", "auto", "zh-CN")


def test_translate_plain_text_ok() -> None:
    provider = _MockProvider()
    assert translate_plain_text(provider, "Hello", "auto", "zh-CN") == "[T]Hello"


async def _create_project(client: AsyncClient) -> int:
    res = await client.post(
        "/projects",
        json={
            "github_url": "https://github.com/o/r",
            "name": "r",
            "full_name": "o/r",
            "description": "English description",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_settings_translation_get_put(client: AsyncClient) -> None:
    res = await client.get("/settings/translation")
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "google"
    assert data["target_lang"] == "zh-CN"

    res = await client.put("/settings/translation", json={"target_lang": "en"})
    assert res.status_code == 200
    assert res.json()["target_lang"] == "en"


@pytest.mark.asyncio
async def test_patch_description_translated(client: AsyncClient) -> None:
    project_id = await _create_project(client)
    res = await client.patch(
        f"/projects/{project_id}",
        json={"description_translated": "中文简介"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["description_translated"] == "中文简介"


@pytest.mark.asyncio
async def test_post_translate_description(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    project_id = await _create_project(client)

    mock = _MockProvider(prefix="ZH:")

    def _fake_get_provider(_name: str):
        return mock

    monkeypatch.setattr("app.services.project_translate.get_translation_provider", _fake_get_provider)

    res = await client.post(
        f"/projects/{project_id}/translate",
        json={"fields": ["description"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["description"] == "ZH:English description"
    assert body["translation_target_lang"] == "zh-CN"


@pytest.mark.asyncio
async def test_post_translate_readme(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    project_id = await _create_project(client)

    async def _fake_ensure_readme(_db, _project):
        return "# Title\n\nBody text"

    mock = _MockProvider(prefix="R:")

    monkeypatch.setattr(
        "app.services.project_translate.ensure_default_readme_content",
        _fake_ensure_readme,
    )
    monkeypatch.setattr("app.services.project_translate.get_translation_provider", lambda _n: mock)

    res = await client.post(
        f"/projects/{project_id}/translate",
        json={"fields": ["readme"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["readme_translated"] is not None
    assert "R:# Title" in body["readme_translated"]
    assert "Body text" in body["readme_translated"]


@pytest.mark.asyncio
async def test_post_translate_text_ephemeral(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    mock = _MockProvider(prefix="ZH:")

    monkeypatch.setattr(
        "app.services.translation_ephemeral.get_translation_provider",
        lambda _n: mock,
    )

    res = await client.post(
        "/translation/translate-text",
        json={"content": "Hello world"},
    )
    assert res.status_code == 200
    assert res.json()["translated"] == "ZH:Hello world"


@pytest.mark.asyncio
async def test_post_translate_text_empty_rejected(client: AsyncClient) -> None:
    res = await client.post("/translation/translate-text", json={"content": "   "})
    assert res.status_code == 422


async def test_post_readme_blocks_ephemeral(client: AsyncClient) -> None:
    res = await client.post(
        "/translation/readme-blocks",
        json={"content": "# Title\n\nHello **world**"},
    )
    assert res.status_code == 200
    blocks = res.json()["blocks"]
    assert isinstance(blocks, list)
    assert len(blocks) >= 1


@pytest.mark.asyncio
async def test_post_translate_readme_block_ephemeral(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_block(_db, content: str) -> str:
        return f"translated:{content[:20]}"

    monkeypatch.setattr(
        "app.api.translation.translate_readme_block_ephemeral",
        fake_block,
    )
    res = await client.post(
        "/translation/translate-readme-block",
        json={"content": "Hello readme"},
    )
    assert res.status_code == 200
    assert res.json()["translated"].startswith("translated:")

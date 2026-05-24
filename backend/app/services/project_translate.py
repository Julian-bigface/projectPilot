"""项目简介 / README 机器翻译业务入口。"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.services.project_github_content import fetch_project_readme
from app.services.settings_translation import (
    get_translation_provider_name,
    get_translation_target_lang,
)
from app.services.translation import get_translation_provider
from app.services.translation.markdown_translate import (
    join_markdown_display_blocks,
    list_markdown_display_blocks,
    translate_markdown,
    translate_markdown_block,
    translate_plain_text,
)
from app.services.translation.provider import TranslationError, TranslationProvider


async def _translate_in_thread(
    provider: TranslationProvider,
    fn,
    *args,
    **kwargs,
) -> str:
    return await asyncio.to_thread(fn, provider, *args, **kwargs)


async def translate_project_description(
    db: AsyncSession,
    project: Project,
) -> None:
    provider_name = await get_translation_provider_name(db)
    target_lang = await get_translation_target_lang(db)
    provider = get_translation_provider(provider_name)
    try:
        translated = await _translate_in_thread(
            provider,
            translate_plain_text,
            project.description or "",
            "auto",
            target_lang,
        )
    except TranslationError:
        raise
    except Exception as err:
        raise TranslationError("简介翻译失败，请稍后重试。") from err
    project.description = translated
    project.translation_target_lang = target_lang
    project.updated_at = datetime.now(UTC)


async def translate_project_readme(
    db: AsyncSession,
    project: Project,
) -> None:
    provider_name = await get_translation_provider_name(db)
    target_lang = await get_translation_target_lang(db)
    provider = get_translation_provider(provider_name)
    readme = await fetch_project_readme(db, project)
    try:
        translated = await _translate_in_thread(
            provider,
            translate_markdown,
            readme.content,
            "auto",
            target_lang,
        )
    except TranslationError:
        raise
    except Exception as err:
        raise TranslationError("README 翻译失败，请稍后重试。") from err
    project.readme_translated = translated
    project.translation_target_lang = target_lang
    project.updated_at = datetime.now(UTC)


async def list_project_readme_blocks(
    db: AsyncSession,
    project: Project,
) -> list[str]:
    readme = await fetch_project_readme(db, project)
    return list_markdown_display_blocks(readme.content)


async def translate_project_readme_block(
    db: AsyncSession,
    content: str,
) -> str:
    provider_name = await get_translation_provider_name(db)
    target_lang = await get_translation_target_lang(db)
    provider = get_translation_provider(provider_name)
    try:
        return await _translate_in_thread(
            provider,
            translate_markdown_block,
            content,
            "auto",
            target_lang,
        )
    except TranslationError:
        raise
    except Exception as err:
        raise TranslationError("段落翻译失败，请稍后重试。") from err


def assemble_readme_translation(blocks: list[str]) -> str:
    return join_markdown_display_blocks(blocks)

"""无项目绑定的纯文本翻译（不落库）。"""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.settings_translation import (
    get_translation_provider_name,
    get_translation_target_lang,
)
from app.services.translation import get_translation_provider
from app.services.translation.markdown_translate import translate_plain_text
from app.services.translation.provider import TranslationError


async def translate_plain_text_ephemeral(db: AsyncSession, content: str) -> str:
    provider_name = await get_translation_provider_name(db)
    target_lang = await get_translation_target_lang(db)
    provider = get_translation_provider(provider_name)
    try:
        return await asyncio.to_thread(
            translate_plain_text,
            provider,
            content,
            "auto",
            target_lang,
        )
    except TranslationError:
        raise
    except Exception as err:
        raise TranslationError("翻译失败，请稍后重试。") from err


async def translate_to_english_for_search(db: AsyncSession, content: str) -> str:
    """发现主题搜索：固定译为英文，不走用户翻译目标语言设置。"""
    provider_name = await get_translation_provider_name(db)
    provider = get_translation_provider(provider_name)
    try:
        return await asyncio.to_thread(
            translate_plain_text,
            provider,
            content,
            "auto",
            "en",
        )
    except TranslationError:
        raise
    except Exception as err:
        raise TranslationError("翻译失败，请稍后重试。") from err

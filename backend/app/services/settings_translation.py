"""翻译相关应用设置（目标语言、Provider）。"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_settings import AppSetting
from app.services.translation import (
    DEFAULT_PROVIDER,
    DEFAULT_TARGET_LANG,
    SUPPORTED_TARGET_LANGS,
)

PROVIDER_SETTING_KEY = "translation_provider"
TARGET_LANG_SETTING_KEY = "translation_target_lang"


async def _get_setting(db: AsyncSession, key: str) -> str | None:
    row = await db.get(AppSetting, key)
    if row is None or row.value is None:
        return None
    return row.value.strip() or None


async def _set_setting(db: AsyncSession, key: str, value: str) -> None:
    row = await db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=value))
    else:
        row.value = value


def normalize_target_lang(value: str | None) -> str:
    if value and value.strip() in SUPPORTED_TARGET_LANGS:
        return value.strip()
    return DEFAULT_TARGET_LANG


def normalize_provider(value: str | None) -> str:
    if value and value.strip() == "google":
        return value.strip()
    return DEFAULT_PROVIDER


async def get_translation_provider_name(db: AsyncSession) -> str:
    return normalize_provider(await _get_setting(db, PROVIDER_SETTING_KEY))


async def get_translation_target_lang(db: AsyncSession) -> str:
    return normalize_target_lang(await _get_setting(db, TARGET_LANG_SETTING_KEY))


async def set_translation_target_lang(db: AsyncSession, target_lang: str) -> None:
    normalized = normalize_target_lang(target_lang)
    await _set_setting(db, TARGET_LANG_SETTING_KEY, normalized)


async def resolve_translation_settings_for_read(
    db: AsyncSession,
) -> tuple[str, str]:
    provider = await get_translation_provider_name(db)
    target_lang = await get_translation_target_lang(db)
    return provider, target_lang

"""GitHub PAT：数据库读写与与环境变量的优先级（数据库优先）。"""

from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.app_settings import AppSetting

GITHUB_SETTING_KEY = "github_personal_access_token"


def effective_github_token(db_value: str | None, env_value: str | None) -> str | None:
    """生效 Token：数据库非空则用之，否则回退环境变量 GITHUB_TOKEN。"""
    if db_value and db_value.strip():
        return db_value.strip()
    if env_value and env_value.strip():
        return env_value.strip()
    return None


def token_preview_last_n(raw: str | None, n: int = 4) -> str | None:
    if not raw or not raw.strip():
        return None
    s = raw.strip()
    if len(s) < n:
        return "*" * len(s)
    return s[-n:]


async def get_github_token_row(db: AsyncSession) -> str | None:
    row = await db.get(AppSetting, GITHUB_SETTING_KEY)
    if row is None or row.value is None:
        return None
    return row.value


async def set_github_token_row(db: AsyncSession, token: str | None) -> None:
    if token is None or not token.strip():
        await db.execute(delete(AppSetting).where(AppSetting.key == GITHUB_SETTING_KEY))
        return
    row = await db.get(AppSetting, GITHUB_SETTING_KEY)
    if row is None:
        db.add(AppSetting(key=GITHUB_SETTING_KEY, value=token.strip()))
    else:
        row.value = token.strip()


async def resolve_github_settings_for_read(db: AsyncSession) -> tuple[bool, str | None]:
    db_val = await get_github_token_row(db)
    env_val = settings.github_token
    eff = effective_github_token(db_val, env_val)
    has = eff is not None
    preview = token_preview_last_n(db_val) if db_val and db_val.strip() else None
    return has, preview

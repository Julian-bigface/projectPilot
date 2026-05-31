from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.schemas.settings_github import (
    GithubProfileRead,
    GithubSettingsRead,
    GithubSettingsUpdate,
    GithubTestRequest,
    GithubTestResponse,
)
from app.schemas.settings_translation import (
    TranslationSettingsRead,
    TranslationSettingsUpdate,
    TranslationTestResponse,
)
from app.services.github_client import fetch_github_user, test_github_token
from app.services.settings_github import (
    effective_github_token,
    get_github_token_row,
    resolve_github_settings_for_read,
    set_github_token_row,
)
from app.services.settings_translation import (
    resolve_translation_settings_for_read,
    set_translation_target_lang,
)
from app.services.translation import SUPPORTED_TARGET_LANGS, get_translation_provider
from app.services.translation.markdown_translate import translate_plain_text
from app.services.translation.provider import TranslationError

router = APIRouter()


@router.get("/github", response_model=GithubSettingsRead)
async def get_github_settings(db: AsyncSession = Depends(get_db)) -> GithubSettingsRead:
    has_token, token_preview, token_length = await resolve_github_settings_for_read(db)
    return GithubSettingsRead(
        has_token=has_token, token_preview=token_preview, token_length=token_length
    )


@router.put("/github", response_model=GithubSettingsRead)
async def put_github_settings(
    body: GithubSettingsUpdate, db: AsyncSession = Depends(get_db)
) -> GithubSettingsRead:
    await set_github_token_row(db, body.token)
    await db.commit()
    has_token, token_preview, token_length = await resolve_github_settings_for_read(db)
    return GithubSettingsRead(
        has_token=has_token, token_preview=token_preview, token_length=token_length
    )


@router.get("/github/profile", response_model=GithubProfileRead)
async def get_github_profile(db: AsyncSession = Depends(get_db)) -> GithubProfileRead:
    db_val = await get_github_token_row(db)
    token = effective_github_token(db_val, app_settings.github_token)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail="未配置 GitHub Token",
        )
    profile = await fetch_github_user(token)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="无法从 GitHub 获取用户信息，请检查 Token 是否有效",
        )
    return GithubProfileRead(
        login=profile["login"],
        name=profile.get("name"),
        avatar_url=profile["avatar_url"],
        html_url=profile["html_url"],
    )


@router.post("/github/test", response_model=GithubTestResponse)
async def post_github_test(
    body: GithubTestRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> GithubTestResponse:
    if body and body.token and body.token.strip():
        token = body.token.strip()
    else:
        db_val = await get_github_token_row(db)
        token = effective_github_token(db_val, app_settings.github_token)
        if token is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="未配置 Token：请在设置中保存 PAT，或设置环境变量 GITHUB_TOKEN",
            )
    ok, msg = await test_github_token(token)
    return GithubTestResponse(ok=ok, message=msg)


@router.get("/translation", response_model=TranslationSettingsRead)
async def get_translation_settings(db: AsyncSession = Depends(get_db)) -> TranslationSettingsRead:
    provider, target_lang = await resolve_translation_settings_for_read(db)
    return TranslationSettingsRead(
        provider=provider,
        target_lang=target_lang,
        supported_target_langs=list(SUPPORTED_TARGET_LANGS),
    )


@router.put("/translation", response_model=TranslationSettingsRead)
async def put_translation_settings(
    body: TranslationSettingsUpdate, db: AsyncSession = Depends(get_db)
) -> TranslationSettingsRead:
    if body.target_lang.strip() not in SUPPORTED_TARGET_LANGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"target_lang 须为: {', '.join(SUPPORTED_TARGET_LANGS)}",
        )
    await set_translation_target_lang(db, body.target_lang)
    await db.commit()
    provider, target_lang = await resolve_translation_settings_for_read(db)
    return TranslationSettingsRead(
        provider=provider,
        target_lang=target_lang,
        supported_target_langs=list(SUPPORTED_TARGET_LANGS),
    )


@router.post("/translation/test", response_model=TranslationTestResponse)
async def post_translation_test(db: AsyncSession = Depends(get_db)) -> TranslationTestResponse:
    provider_name, target_lang = await resolve_translation_settings_for_read(db)
    provider = get_translation_provider(provider_name)
    try:
        sample = await asyncio.to_thread(
            translate_plain_text, provider, "Hello", "en", target_lang
        )
    except TranslationError as err:
        return TranslationTestResponse(ok=False, message=str(err))
    except Exception as err:
        return TranslationTestResponse(ok=False, message=f"翻译测试失败：{err}")
    return TranslationTestResponse(ok=True, sample=sample, message="翻译通道可用")

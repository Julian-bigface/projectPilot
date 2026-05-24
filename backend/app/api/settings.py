from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.schemas.settings_github import GithubSettingsRead, GithubSettingsUpdate, GithubTestResponse
from app.services.github_client import test_github_token
from app.services.settings_github import (
    effective_github_token,
    get_github_token_row,
    resolve_github_settings_for_read,
    set_github_token_row,
)

router = APIRouter()


@router.get("/github", response_model=GithubSettingsRead)
async def get_github_settings(db: AsyncSession = Depends(get_db)) -> GithubSettingsRead:
    has_token, token_preview = await resolve_github_settings_for_read(db)
    return GithubSettingsRead(has_token=has_token, token_preview=token_preview)


@router.put("/github", response_model=GithubSettingsRead)
async def put_github_settings(
    body: GithubSettingsUpdate, db: AsyncSession = Depends(get_db)
) -> GithubSettingsRead:
    await set_github_token_row(db, body.token)
    await db.commit()
    has_token, token_preview = await resolve_github_settings_for_read(db)
    return GithubSettingsRead(has_token=has_token, token_preview=token_preview)


@router.post("/github/test", response_model=GithubTestResponse)
async def post_github_test(db: AsyncSession = Depends(get_db)) -> GithubTestResponse:
    db_val = await get_github_token_row(db)
    token = effective_github_token(db_val, app_settings.github_token)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 Token：请在设置中保存 PAT，或设置环境变量 GITHUB_TOKEN",
        )
    ok, msg = await test_github_token(token)
    return GithubTestResponse(ok=ok, message=msg)

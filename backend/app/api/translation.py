from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.translation import PlainTextTranslateRead, PlainTextTranslateRequest
from app.services.translation_ephemeral import translate_plain_text_ephemeral
from app.services.translation.provider import TranslationError

router = APIRouter()


@router.post("/translate-text", response_model=PlainTextTranslateRead)
async def post_translate_text(
    body: PlainTextTranslateRequest,
    db: AsyncSession = Depends(get_db),
) -> PlainTextTranslateRead:
    try:
        translated = await translate_plain_text_ephemeral(db, body.content)
    except TranslationError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail="翻译失败，请稍后重试。",
        ) from err
    return PlainTextTranslateRead(translated=translated)

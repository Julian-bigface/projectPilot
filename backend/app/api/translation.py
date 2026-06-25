from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.project_translate import (
    ReadmeBlockTranslateRead,
    ReadmeBlockTranslateRequest,
    ReadmeBlocksRead,
)
from app.schemas.translation import PlainTextTranslateRead, PlainTextTranslateRequest
from app.services.translation_ephemeral import (
    list_readme_blocks_ephemeral,
    translate_plain_text_ephemeral,
    translate_readme_block_ephemeral,
)
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


@router.post("/readme-blocks", response_model=ReadmeBlocksRead)
async def post_readme_blocks_ephemeral(body: PlainTextTranslateRequest) -> ReadmeBlocksRead:
    return ReadmeBlocksRead(blocks=list_readme_blocks_ephemeral(body.content))


@router.post("/translate-readme-block", response_model=ReadmeBlockTranslateRead)
async def post_translate_readme_block_ephemeral(
    body: ReadmeBlockTranslateRequest,
    db: AsyncSession = Depends(get_db),
) -> ReadmeBlockTranslateRead:
    try:
        translated = await translate_readme_block_ephemeral(db, body.content)
    except TranslationError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail="段落翻译失败，请稍后重试。",
        ) from err
    return ReadmeBlockTranslateRead(translated=translated)

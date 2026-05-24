from __future__ import annotations

from pydantic import BaseModel, Field

from app.services.translation import SUPPORTED_TARGET_LANGS


class TranslationSettingsRead(BaseModel):
    provider: str = Field(..., description="翻译 Provider（首版固定 google）")
    target_lang: str = Field(..., description="目标语言 BCP-47")
    supported_target_langs: list[str] = Field(
        default_factory=lambda: list(SUPPORTED_TARGET_LANGS),
        description="可选目标语言列表",
    )


class TranslationSettingsUpdate(BaseModel):
    target_lang: str = Field(..., min_length=2, max_length=16)


class TranslationTestResponse(BaseModel):
    ok: bool
    sample: str | None = None
    message: str | None = None

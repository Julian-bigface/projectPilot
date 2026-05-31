from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class PlainTextTranslateRequest(BaseModel):
    content: str = Field(..., min_length=1, description="待翻译的纯文本")

    @field_validator("content")
    @classmethod
    def strip_and_require_non_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("content 不能为空")
        return stripped


class PlainTextTranslateRead(BaseModel):
    translated: str

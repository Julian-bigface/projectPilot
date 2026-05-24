from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

TranslateFieldLiteral = Literal["description", "readme"]


class ProjectTranslateRequest(BaseModel):
    fields: list[TranslateFieldLiteral] = Field(
        ...,
        min_length=1,
        description="要翻译的字段：description（简介）或 readme",
    )

    @field_validator("fields")
    @classmethod
    def dedupe_fields(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in v:
            if item not in seen:
                seen.add(item)
                out.append(item)
        return out


class ReadmeBlocksRead(BaseModel):
    blocks: list[str] = Field(default_factory=list)


class ReadmeBlockTranslateRequest(BaseModel):
    content: str = Field(..., min_length=1, description="待翻译的 Markdown 段落")


class ReadmeBlockTranslateRead(BaseModel):
    translated: str

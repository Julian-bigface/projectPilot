from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TagCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    sort_order: int | None = Field(None, description="不传则追加到末尾")


class TagCategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    sort_order: int | None = None


class TagCategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sort_order: int
    created_at: datetime

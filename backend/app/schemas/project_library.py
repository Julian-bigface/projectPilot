from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectLibraryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: str | None = None


class ProjectLibraryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=256)
    description: str | None = None
    is_pinned: bool | None = None
    sort_order: int | None = None


class ProjectLibraryRead(BaseModel):
    id: int
    name: str
    description: str | None
    is_pinned: bool
    sort_order: int
    project_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

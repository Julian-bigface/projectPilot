from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.project import TagBrief


class FolderReorder(BaseModel):
    """同级文件夹排序：ordered_ids 必须与该 parent_id 下现有子文件夹 id 集合完全一致。"""

    parent_id: int | None = None
    ordered_ids: list[int] = Field(..., min_length=1)


class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    parent_id: int | None = None


class FolderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=256)
    parent_id: int | None = None
    description: str | None = None
    tag_ids: list[int] | None = Field(
        None,
        description="若传入则整表替换该文件夹的标签关联（空列表表示清空）",
    )


class FolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: int | None
    name: str
    description: str | None = None
    sort_order: int
    tags: list[TagBrief] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    category_id: int | None = Field(None, description="为空表示未分类")


class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=256)
    category_id: int | None = Field(None, description="设为 null 表示移回未分类；不传则不修改分类")


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int | None = None
    category_name: str | None = None
    project_usage_count: int = Field(0, ge=0, description="未删除项目上的关联数")
    folder_usage_count: int = Field(0, ge=0, description="文件夹上的关联数")
    usage_count: int = Field(0, ge=0, description="project_usage_count + folder_usage_count")

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

PROJECT_STATES = ("未体验", "正在体验", "推荐归档", "放弃归档")


class TagBrief(BaseModel):
    """项目详情/列表中携带的标签摘要。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int | None = None

ProjectStateLiteral = Literal["未体验", "正在体验", "推荐归档", "放弃归档"]


class ProjectBase(BaseModel):
    github_url: str = Field(..., max_length=2048)
    name: str = Field(..., max_length=512)
    full_name: str = Field(..., max_length=512)
    description: str | None = None
    description_translated: str | None = None
    readme_translated: str | None = None
    translation_target_lang: str | None = Field(None, max_length=16)
    stars: int = Field(default=0, ge=0)
    language: str | None = Field(None, max_length=128)
    author: str | None = Field(None, max_length=512)
    license: str | None = Field(None, max_length=256)
    ai_summary: str | None = None
    notes: str | None = None
    deploy_methods: list[str] | None = None
    topics: list[str] = Field(default_factory=list)
    forks: int = Field(default=0, ge=0)
    github_pushed_at: datetime | None = None
    github_release_tag: str | None = Field(None, max_length=256)
    state: ProjectStateLiteral = "未体验"

    @field_validator("topics", mode="before")
    @classmethod
    def topics_none_as_empty(cls, v: object) -> object:
        return [] if v is None else v


class ProjectCreate(ProjectBase):
    """手动创建项目（Phase 1 不含 GitHub 拉取）。"""

    folder_id: int | None = None

    model_config = ConfigDict(json_schema_extra={"example": {
        "github_url": "https://github.com/refinedev/refine",
        "name": "refine",
        "full_name": "refinedev/refine",
        "description": "React meta-framework",
        "stars": 12000,
        "language": "TypeScript",
    }})


class ProjectUpdate(BaseModel):
    github_url: str | None = Field(None, max_length=2048)
    name: str | None = Field(None, max_length=512)
    full_name: str | None = Field(None, max_length=512)
    description: str | None = None
    description_translated: str | None = None
    readme_translated: str | None = None
    stars: int | None = Field(None, ge=0)
    language: str | None = Field(None, max_length=128)
    author: str | None = Field(None, max_length=512)
    license: str | None = Field(None, max_length=256)
    ai_summary: str | None = None
    notes: str | None = None
    deploy_methods: list[str] | None = None
    state: ProjectStateLiteral | None = None
    folder_id: int | None = None
    tag_ids: list[int] | None = Field(
        None,
        description="若传入则整表替换该项目的标签关联（空列表表示清空）",
    )


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    folder_id: int | None = None
    folder_name: str | None = None
    tags: list[TagBrief] = Field(default_factory=list)
    state_changed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TagCategorySuggestRequest(BaseModel):
    tag_ids: list[int] | None = Field(
        default=None,
        description="仅处理指定未分类标签；省略则处理库内全部未分类",
    )
    include_new_categories: bool = Field(
        default=False,
        description="允许 LLM 建议新建分类名（apply 时再创建）",
    )


class TagCategoryProposal(BaseModel):
    tag_id: int
    tag_name: str
    category_id: int | None = None
    new_category_name: str | None = None
    confidence: Literal["high", "medium", "low"] = "medium"
    reason: str | None = None


class TagCategorySuggestResponse(BaseModel):
    proposals: list[TagCategoryProposal] = Field(default_factory=list)
    batches: int = 0
    skipped_tag_ids: list[int] = Field(default_factory=list)


class TagCategorySuggestStreamStart(BaseModel):
    event: Literal["start"] = "start"
    total_batches: int
    total_tags: int


class TagCategorySuggestStreamBatchStart(BaseModel):
    event: Literal["batch_start"] = "batch_start"
    batch_index: int
    total_batches: int
    tag_count: int


class TagCategorySuggestStreamBatch(BaseModel):
    event: Literal["batch"] = "batch"
    batch_index: int
    total_batches: int
    proposals: list[TagCategoryProposal] = Field(default_factory=list)
    skipped_tag_ids: list[int] = Field(default_factory=list)


class TagCategorySuggestStreamDone(BaseModel):
    event: Literal["done"] = "done"
    batches: int
    skipped_tag_ids: list[int] = Field(default_factory=list)
    proposal_count: int = 0


class TagCategoryApplyItem(BaseModel):
    tag_id: int
    category_id: int | None = None
    new_category_name: str | None = Field(
        default=None,
        description="category_id 为空且提供此项时，apply 阶段 get-or-create 分类",
    )


class TagCategoryApplyRequest(BaseModel):
    items: list[TagCategoryApplyItem] = Field(..., min_length=1)


class TagCategoryApplyResponse(BaseModel):
    applied: int = 0
    categories_created: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)

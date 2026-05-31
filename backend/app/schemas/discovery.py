from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TrendingRange = Literal["daily", "weekly", "monthly"]
DiscoverySource = Literal["rss", "github_search"]
TopicSearchMode = Literal["category", "bilingual", "plain"]


class DiscoveryTopicSearchMetaRead(BaseModel):
    mode: TopicSearchMode
    terms: list[str] = Field(default_factory=list)
    category_name: str | None = None
    translated: str | None = None
    translation_failed: bool = False


class DiscoveryRepoRead(BaseModel):
    rank: int = Field(..., ge=1)
    full_name: str
    name: str
    github_url: str
    html_url: str
    description: str | None = None
    stars: int = Field(default=0, ge=0)
    forks: int = Field(default=0, ge=0)
    language: str | None = None
    topics: list[str] = Field(default_factory=list)
    owner_login: str | None = None
    owner_avatar_url: str | None = None
    pushed_at: datetime | None = None


class DiscoveryPageRead(BaseModel):
    items: list[DiscoveryRepoRead]
    page: int = Field(..., ge=1)
    per_page: int = Field(..., ge=1, le=50)
    has_more: bool
    total_count: int | None = None
    fetched_at: datetime
    source: DiscoverySource
    search_meta: DiscoveryTopicSearchMetaRead | None = None


class DiscoveryEnrichEntry(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=512)
    rank: int = Field(..., ge=1)
    name: str | None = None
    html_url: str | None = None
    description: str | None = None
    stars: int = Field(default=0, ge=0)
    forks: int = Field(default=0, ge=0)


class DiscoveryEnrichRequest(BaseModel):
    items: list[DiscoveryEnrichEntry] = Field(..., min_length=1, max_length=50)


class DiscoveryEnrichRead(BaseModel):
    items: list[DiscoveryRepoRead]
    fetched_at: datetime

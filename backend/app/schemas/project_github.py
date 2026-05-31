from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ProjectReadmeRead(BaseModel):
    content: str
    source: Literal["cache", "github"] = "github"
    path: str | None = None
    is_default: bool = True
    cached_at: datetime | None = None
    github_sha: str | None = None
    content_changed: bool = False


class ProjectReleaseAssetRead(BaseModel):
    name: str
    size: int | None = None
    download_count: int = 0
    browser_download_url: str
    updated_at: datetime | None = None


class ProjectReleaseRead(BaseModel):
    tag_name: str
    name: str | None = None
    body: str | None = None
    published_at: datetime | None = None
    html_url: str | None = None
    prerelease: bool = False
    draft: bool = False
    assets: list[ProjectReleaseAssetRead] = Field(default_factory=list)


class ProjectReleasesRead(BaseModel):
    items: list[ProjectReleaseRead] = Field(default_factory=list)
    source: Literal["cache", "github"] = "github"
    cached_at: datetime | None = None
    content_changed: bool = False


class GithubRepoPreviewRead(BaseModel):
    """添加项目前从 GitHub 拉取的仓库简介预览。"""

    full_name: str | None = None
    description: str | None = None
    fetched: bool = False
    error: str | None = Field(
        None,
        description="无法获取时的用户可读说明（网络、Token、仓库不存在等）",
    )

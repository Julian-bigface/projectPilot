from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.project import PROJECT_STATES, ProjectStateLiteral

BUNDLE_KIND = "project_pilot.folder_bundle"
BUNDLE_FORMAT_VERSION = 1


class BundleTagSpec(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    category_name: str | None = Field(None, max_length=128)


class BundleFolderSpec(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    parent_key: str | None = None
    name: str = Field(..., min_length=1, max_length=256)
    description: str | None = None
    sort_order: int = 0
    tags: list[BundleTagSpec] = Field(default_factory=list)


class BundleProjectSpec(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    folder_key: str | None = None
    github_url: str = Field(..., max_length=2048)
    name: str = Field(..., max_length=512)
    full_name: str = Field(..., max_length=512)
    description: str | None = None
    stars: int = Field(default=0, ge=0)
    language: str | None = Field(None, max_length=128)
    author: str | None = Field(None, max_length=512)
    license: str | None = Field(None, max_length=256)
    ai_summary: str | None = None
    notes: str | None = None
    deploy_methods: list[str] | None = None
    state: ProjectStateLiteral = "未体验"
    tags: list[BundleTagSpec] = Field(default_factory=list)


class BundleSourceInfo(BaseModel):
    library_name: str
    root_folder_name: str


class FolderBundle(BaseModel):
    format_version: Literal[1] = BUNDLE_FORMAT_VERSION
    kind: Literal["project_pilot.folder_bundle"] = BUNDLE_KIND
    exported_at: datetime
    source: BundleSourceInfo
    folders: list[BundleFolderSpec]
    projects: list[BundleProjectSpec]


class FolderBundleImportRequest(BaseModel):
    bundle: FolderBundle
    target_parent_folder_id: int | None = None
    skip_duplicate_github_url: bool = False


class FolderBundleImportResult(BaseModel):
    created_folders: int
    created_projects: int
    skipped_projects: int
    errors: list[str] = Field(default_factory=list)

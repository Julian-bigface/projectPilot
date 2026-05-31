from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_library_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_libraries.id", ondelete="CASCADE"),
        index=True,
    )
    folder_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    github_url: Mapped[str] = mapped_column(String(2048), index=True)
    name: Mapped[str] = mapped_column(String(512))
    full_name: Mapped[str] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_translated: Mapped[str | None] = mapped_column(Text, nullable=True)
    readme_translated: Mapped[str | None] = mapped_column(Text, nullable=True)
    readme_cached: Mapped[str | None] = mapped_column(Text, nullable=True)
    readme_cached_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    readme_github_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    readme_cached_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    releases_cached: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    releases_cached_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    releases_cache_fingerprint: Mapped[str | None] = mapped_column(String(512), nullable=True)
    translation_target_lang: Mapped[str | None] = mapped_column(String(16), nullable=True)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str | None] = mapped_column(String(128), nullable=True)
    author: Mapped[str | None] = mapped_column(String(512), nullable=True)
    license: Mapped[str | None] = mapped_column(String(256), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    deploy_methods: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    topics: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    forks: Mapped[int] = mapped_column(Integer, default=0)
    github_pushed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    github_release_tag: Mapped[str | None] = mapped_column(String(256), nullable=True)
    state: Mapped[str] = mapped_column(String(32), index=True, default="未体验")
    state_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

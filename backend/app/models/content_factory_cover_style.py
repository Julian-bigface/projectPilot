from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ContentFactoryCoverStyle(Base):
    __tablename__ = "content_factory_cover_styles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    style_id: Mapped[str] = mapped_column(String(64), index=True)
    project_library_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_libraries.id", ondelete="CASCADE"),
        index=True,
    )
    label: Mapped[str] = mapped_column(String(128))
    source: Mapped[str] = mapped_column(String(32), default="manual")
    prompt_prefix: Mapped[str] = mapped_column(Text, default="")
    prompt_template: Mapped[str] = mapped_column(Text, default="")
    negative_prompt: Mapped[str] = mapped_column(Text, default="")
    color_tokens: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    font_tokens: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    style_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    design_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fork_from_style_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    example_image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    reference_image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ContentFactoryStyleHidden(Base):
    """Per-library hidden flag for builtin style ids."""

    __tablename__ = "content_factory_style_hidden"

    project_library_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_libraries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    style_id: Mapped[str] = mapped_column(String(64), primary_key=True)

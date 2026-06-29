from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ContentFactoryCoverStyleRevision(Base):
    __tablename__ = "content_factory_cover_style_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    style_id: Mapped[str] = mapped_column(String(64), index=True)
    revision_index: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(32), default="ai_refine")
    instruction: Mapped[str | None] = mapped_column(String(500), nullable=True)
    snapshot_json: Mapped[dict] = mapped_column(JSON)
    example_image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

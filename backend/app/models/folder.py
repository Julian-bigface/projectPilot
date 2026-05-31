from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Folder(Base):
    """侧边栏文件树文件夹（支持嵌套 parent_id）。"""

    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_library_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_libraries.id", ondelete="CASCADE"),
        index=True,
    )
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("folders.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

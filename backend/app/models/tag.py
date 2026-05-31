from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TagCategory(Base):
    """用户自定义标签分类。"""

    __tablename__ = "tag_categories"
    __table_args__ = (
        UniqueConstraint("project_library_id", "name", name="uq_tag_category_library_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_library_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_libraries.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(128), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Tag(Base):
    """标签定义；category_id 为空表示「未分类」。"""

    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("project_library_id", "name", name="uq_tag_library_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_library_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("project_libraries.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(256), index=True)
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("tag_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ProjectTag(Base):
    """项目与标签的多对多关联。"""

    __tablename__ = "project_tags"
    __table_args__ = (UniqueConstraint("project_id", "tag_id", name="uq_project_tag"),)

    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )


class FolderTag(Base):
    """文件夹与标签的多对多关联。"""

    __tablename__ = "folder_tags"
    __table_args__ = (UniqueConstraint("folder_id", "tag_id", name="uq_folder_tag"),)

    folder_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("folders.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )

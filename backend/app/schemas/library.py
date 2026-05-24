from __future__ import annotations

from pydantic import BaseModel

from app.schemas.project import ProjectRead


class FolderTreeNode(BaseModel):
    id: int
    name: str
    children: list[FolderTreeNode]
    projects: list[ProjectRead]


FolderTreeNode.model_rebuild()


class LibraryTreeResponse(BaseModel):
    """语雀式侧边栏：顶层文件夹树 + 未归入文件夹的项目。"""

    folders: list[FolderTreeNode]
    orphan_projects: list[ProjectRead]

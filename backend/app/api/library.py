from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_project_library
from app.core.database import get_db
from app.models.folder import Folder
from app.models.project import Project
from app.models.project_library import ProjectLibrary
from app.schemas.library import FolderTreeNode, LibraryTreeResponse
from app.schemas.project import TagBrief
from app.services.folder_read import load_tags_map_for_folders
from app.services.project_read import load_tags_map_for_projects, project_read_with_folder_name

router = APIRouter()


def _build_folder_tree(
    all_folders: list[Folder],
    all_projects: list[Project],
    parent_id: int | None,
    project_tag_map: dict[int, list[TagBrief]],
    folder_tag_map: dict[int, list[TagBrief]],
) -> list[FolderTreeNode]:
    children_f = [f for f in all_folders if f.parent_id == parent_id]
    children_f.sort(key=lambda x: (x.sort_order, x.name))
    nodes: list[FolderTreeNode] = []
    for f in children_f:
        projs = [p for p in all_projects if p.folder_id == f.id]
        projs.sort(key=lambda p: p.updated_at, reverse=True)
        nodes.append(
            FolderTreeNode(
                id=f.id,
                name=f.name,
                tags=folder_tag_map.get(f.id, []),
                children=_build_folder_tree(
                    all_folders, all_projects, f.id, project_tag_map, folder_tag_map
                ),
                projects=[
                    project_read_with_folder_name(p, f.name, project_tag_map.get(p.id, []))
                    for p in projs
                ],
            )
        )
    return nodes


@router.get("/tree", response_model=LibraryTreeResponse)
async def get_library_tree(
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> LibraryTreeResponse:
    folders = (
        (await db.execute(select(Folder).where(Folder.project_library_id == library.id)))
        .scalars()
        .all()
    )
    projects = (
        (
            await db.execute(
                select(Project).where(
                    Project.deleted_at.is_(None),
                    Project.project_library_id == library.id,
                )
            )
        )
        .scalars()
        .all()
    )
    orphans = [p for p in projects if p.folder_id is None]
    orphans.sort(key=lambda p: p.updated_at, reverse=True)
    project_tag_map = await load_tags_map_for_projects(db, [p.id for p in projects])
    folder_tag_map = await load_tags_map_for_folders(db, [f.id for f in folders])
    roots = _build_folder_tree(
        list(folders), list(projects), None, project_tag_map, folder_tag_map
    )
    return LibraryTreeResponse(
        folders=roots,
        orphan_projects=[
            project_read_with_folder_name(p, None, project_tag_map.get(p.id, []))
            for p in orphans
        ],
    )

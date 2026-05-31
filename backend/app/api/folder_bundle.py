from __future__ import annotations

import json
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_project_library
from app.core.database import get_db
from app.models.folder import Folder
from app.models.project_library import ProjectLibrary
from app.schemas.folder_bundle import FolderBundle, FolderBundleImportRequest, FolderBundleImportResult
from app.services.folder_bundle import build_folder_bundle, import_folder_bundle

router = APIRouter()


def _attachment_content_disposition(filename: str) -> str:
    """Content-Disposition 值：ASCII 回退名 + RFC 5987 filename*（避免中文等触发 latin-1 编码错误）。"""
    ascii_fallback = (
        "".join(
            c if ord(c) < 128 and (c.isalnum() or c in "._-") else "_"
            for c in filename
        ).strip("._")[:80]
        or "folder.ppb.json"
    )
    if not ascii_fallback.lower().endswith(".json"):
        ascii_fallback = f"{ascii_fallback}.ppb.json"
    encoded = quote(filename, safe="")
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


async def _get_folder_in_library(
    db: AsyncSession, folder_id: int, library_id: int
) -> Folder:
    row = await db.get(Folder, folder_id)
    if row is None or row.project_library_id != library_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")
    return row


@router.get("/folders/{folder_id}/export")
async def export_folder_bundle(
    folder_id: int,
    library: ProjectLibrary = Depends(get_project_library),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await _get_folder_in_library(db, folder_id, library.id)
    bundle = await build_folder_bundle(db, library.id, folder_id)
    filename = f"{bundle.source.root_folder_name}.ppb.json"
    body = json.dumps(bundle.model_dump(mode="json"), ensure_ascii=False, indent=2)
    return Response(
        content=body.encode("utf-8"),
        media_type="application/json",
        headers={"Content-Disposition": _attachment_content_disposition(filename)},
    )


@router.post("/import/folder-bundle", response_model=FolderBundleImportResult)
async def post_import_folder_bundle(
    body: FolderBundleImportRequest,
    library: ProjectLibrary = Depends(get_project_library),
    db: AsyncSession = Depends(get_db),
) -> FolderBundleImportResult:
    return await import_folder_bundle(
        db,
        library.id,
        body.target_parent_folder_id,
        body.bundle,
        skip_duplicate_github_url=body.skip_duplicate_github_url,
    )

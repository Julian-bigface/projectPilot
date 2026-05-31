from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.project_library import ProjectLibrary


async def get_project_library(
    library_id: int,
    db: AsyncSession = Depends(get_db),
) -> ProjectLibrary:
    row = await db.get(ProjectLibrary, library_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目库不存在")
    return row

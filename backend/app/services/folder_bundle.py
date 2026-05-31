"""文件夹子树导出/导入（便携 JSON 包）。"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder
from app.models.project import Project
from app.models.project_library import ProjectLibrary
from app.models.tag import FolderTag, ProjectTag, Tag, TagCategory
from app.schemas.folder_bundle import (
    BUNDLE_FORMAT_VERSION,
    BUNDLE_KIND,
    BundleFolderSpec,
    BundleProjectSpec,
    BundleSourceInfo,
    BundleTagSpec,
    FolderBundle,
    FolderBundleImportResult,
)
from app.schemas.project import PROJECT_STATES
from app.services.tag_normalize import normalize_tag_name


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def collect_subtree_folder_ids(db: AsyncSession, root_id: int) -> list[int]:
    """子树内所有文件夹 id，后序（子先于父），含 root_id。"""
    child_ids = (
        (await db.execute(select(Folder.id).where(Folder.parent_id == root_id).order_by(Folder.id.asc())))
        .scalars()
        .all()
    )
    out: list[int] = []
    for cid in child_ids:
        out.extend(await collect_subtree_folder_ids(db, cid))
    out.append(root_id)
    return out


def _folder_key(folder_id: int) -> str:
    return f"f{folder_id}"


async def _load_category_name_map(db: AsyncSession, category_ids: set[int]) -> dict[int, str]:
    if not category_ids:
        return {}
    rows = (
        await db.execute(select(TagCategory.id, TagCategory.name).where(TagCategory.id.in_(category_ids)))
    ).all()
    return {int(r[0]): r[1] for r in rows}


def _tag_briefs_to_specs(
  tags: list,
  category_names: dict[int, str],
) -> list[BundleTagSpec]:
    out: list[BundleTagSpec] = []
    for t in tags:
        cn = category_names.get(t.category_id) if t.category_id is not None else None
        out.append(BundleTagSpec(name=t.name, category_name=cn))
    return out


async def build_folder_bundle(
    db: AsyncSession,
    library_id: int,
    root_folder_id: int,
) -> FolderBundle:
    root = await db.get(Folder, root_folder_id)
    if root is None or root.project_library_id != library_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")

    lib = await db.get(ProjectLibrary, library_id)
    library_name = lib.name if lib is not None else ""

    subtree_ids = await collect_subtree_folder_ids(db, root_folder_id)
    id_set = set(subtree_ids)

    folders = (
        (await db.execute(select(Folder).where(Folder.id.in_(subtree_ids)))).scalars().all()
    )
    folders_by_id = {f.id: f for f in folders}

    from app.services.folder_read import load_tags_map_for_folders
    from app.services.project_read import load_tags_map_for_projects

    ftags = await load_tags_map_for_folders(db, subtree_ids)
    category_ids = {t.category_id for tags in ftags.values() for t in tags if t.category_id is not None}
    cat_names = await _load_category_name_map(db, category_ids)

    bundle_folders: list[BundleFolderSpec] = []
    for fid in subtree_ids:
        f = folders_by_id[fid]
        parent_key = None
        if f.parent_id is not None and f.parent_id in id_set:
            parent_key = _folder_key(f.parent_id)
        tag_specs = _tag_briefs_to_specs(ftags.get(fid, []), cat_names)
        bundle_folders.append(
            BundleFolderSpec(
                key=_folder_key(fid),
                parent_key=parent_key,
                name=f.name,
                description=f.description,
                sort_order=f.sort_order,
                tags=tag_specs,
            )
        )

    projects = (
        (
            await db.execute(
                select(Project).where(
                    Project.project_library_id == library_id,
                    Project.folder_id.in_(subtree_ids),
                    Project.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    pids = [p.id for p in projects]
    ptags = await load_tags_map_for_projects(db, pids)
    category_ids_p = {
        t.category_id for tags in ptags.values() for t in tags if t.category_id is not None
    }
    cat_names_p = await _load_category_name_map(db, category_ids_p | category_ids)

    bundle_projects: list[BundleProjectSpec] = []
    for p in projects:
        folder_key = _folder_key(p.folder_id) if p.folder_id is not None else None
        tag_specs = _tag_briefs_to_specs(ptags.get(p.id, []), cat_names_p)
        bundle_projects.append(
            BundleProjectSpec(
                key=f"p{p.id}",
                folder_key=folder_key,
                github_url=p.github_url,
                name=p.name,
                full_name=p.full_name,
                description=p.description,
                stars=p.stars,
                language=p.language,
                author=p.author,
                license=p.license,
                ai_summary=p.ai_summary,
                notes=p.notes,
                deploy_methods=p.deploy_methods,
                state=p.state if p.state in PROJECT_STATES else "未体验",
                tags=tag_specs,
            )
        )

    return FolderBundle(
        exported_at=_utcnow(),
        source=BundleSourceInfo(library_name=library_name, root_folder_name=root.name),
        folders=bundle_folders,
        projects=bundle_projects,
    )


async def _ensure_target_parent(
    db: AsyncSession, library_id: int, target_parent_folder_id: int | None
) -> None:
    if target_parent_folder_id is None:
        return
    parent = await db.get(Folder, target_parent_folder_id)
    if parent is None or parent.project_library_id != library_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="target_parent_folder_id 无效")


def _validate_bundle(bundle: FolderBundle) -> None:
    if bundle.format_version != BUNDLE_FORMAT_VERSION or bundle.kind != BUNDLE_KIND:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的包格式或版本",
        )
    keys = {f.key for f in bundle.folders}
    if len(keys) != len(bundle.folders):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="folders 中存在重复 key")
    for f in bundle.folders:
        if f.parent_key is not None and f.parent_key not in keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件夹 {f.key} 的 parent_key 无效",
            )
    for p in bundle.projects:
        if p.folder_key is not None and p.folder_key not in keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"项目 {p.key} 的 folder_key 无效",
            )


async def _resolve_tag_id(
    db: AsyncSession,
    library_id: int,
    spec: BundleTagSpec,
    cache: dict[tuple[str, str | None], int],
) -> int:
    cat_key = normalize_tag_name(spec.category_name) if spec.category_name else None
    name = normalize_tag_name(spec.name)
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="标签名不能为空")
    cache_key = (name, cat_key)
    if cache_key in cache:
        return cache[cache_key]

    category_id: int | None = None
    if cat_key:
        row = (
            await db.execute(
                select(TagCategory).where(
                    TagCategory.project_library_id == library_id,
                    TagCategory.name == cat_key,
                )
            )
        ).scalar_one_or_none()
        if row is None:
            from sqlalchemy import func

            max_so = await db.scalar(
                select(func.coalesce(func.max(TagCategory.sort_order), -1)).where(
                    TagCategory.project_library_id == library_id
                )
            )
            next_order = int(max_so if max_so is not None else -1) + 1
            cat = TagCategory(name=cat_key, project_library_id=library_id, sort_order=next_order)
            db.add(cat)
            await db.flush()
            category_id = cat.id
        else:
            category_id = row.id

    tag_row = (
        await db.execute(
            select(Tag).where(Tag.project_library_id == library_id, Tag.name == name)
        )
    ).scalar_one_or_none()
    if tag_row is None:
        tag_row = Tag(name=name, project_library_id=library_id, category_id=category_id)
        db.add(tag_row)
        await db.flush()
    else:
        if category_id is not None and tag_row.category_id != category_id:
            tag_row.category_id = category_id
            await db.flush()

    cache[cache_key] = tag_row.id
    return tag_row.id


async def _resolve_tag_ids(
    db: AsyncSession,
    library_id: int,
    specs: list[BundleTagSpec],
    cache: dict[tuple[str, str | None], int],
) -> list[int]:
    ids: list[int] = []
    for spec in specs:
        tid = await _resolve_tag_id(db, library_id, spec, cache)
        ids.append(tid)
    return list(dict.fromkeys(ids))


async def _unique_folder_name(
    db: AsyncSession,
    library_id: int,
    parent_id: int | None,
    desired: str,
) -> str:
    base = desired.strip()
    siblings = (
        (
            await db.execute(
                select(Folder.name).where(
                    Folder.project_library_id == library_id,
                    Folder.parent_id == parent_id,
                )
            )
        )
        .scalars()
        .all()
    )
    existing = set(siblings)
    if base not in existing:
        return base
    n = 1
    while True:
        candidate = f"{base} ({n})"
        if candidate not in existing:
            return candidate
        n += 1


async def _next_sort_order(db: AsyncSession, parent_id: int | None, library_id: int) -> int:
    from sqlalchemy import func

    m = await db.scalar(
        select(func.max(Folder.sort_order)).where(
            Folder.parent_id == parent_id, Folder.project_library_id == library_id
        )
    )
    return (m if m is not None else -1) + 1


async def _existing_github_urls(db: AsyncSession, library_id: int) -> set[str]:
    rows = (
        await db.execute(
            select(Project.github_url).where(
                Project.project_library_id == library_id,
                Project.deleted_at.is_(None),
            )
        )
    ).scalars().all()
    return set(rows)


async def _sync_folder_tags(db: AsyncSession, folder_id: int, tag_ids: list[int]) -> None:
    await db.execute(delete(FolderTag).where(FolderTag.folder_id == folder_id))
    for tid in tag_ids:
        db.add(FolderTag(folder_id=folder_id, tag_id=tid))


async def _sync_project_tags(db: AsyncSession, project_id: int, tag_ids: list[int]) -> None:
    await db.execute(delete(ProjectTag).where(ProjectTag.project_id == project_id))
    for tid in tag_ids:
        db.add(ProjectTag(project_id=project_id, tag_id=tid))


async def import_folder_bundle(
    db: AsyncSession,
    library_id: int,
    target_parent_folder_id: int | None,
    bundle: FolderBundle,
    *,
    skip_duplicate_github_url: bool = False,
) -> FolderBundleImportResult:
    _validate_bundle(bundle)
    await _ensure_target_parent(db, library_id, target_parent_folder_id)

    tag_cache: dict[tuple[str, str | None], int] = {}
    key_to_folder_id: dict[str, int] = {}
    created_folders = 0
    created_projects = 0
    skipped_projects = 0
    errors: list[str] = []

    pending = list(bundle.folders)
    while pending:
        progressed = False
        for i, spec in enumerate(pending):
            if spec.parent_key is not None and spec.parent_key not in key_to_folder_id:
                continue
            parent_db_id = (
                target_parent_folder_id if spec.parent_key is None else key_to_folder_id[spec.parent_key]
            )
            unique_name = await _unique_folder_name(db, library_id, parent_db_id, spec.name)
            sort_order = spec.sort_order
            if spec.sort_order == 0:
                sort_order = await _next_sort_order(db, parent_db_id, library_id)
            folder = Folder(
                project_library_id=library_id,
                parent_id=parent_db_id,
                name=unique_name,
                description=spec.description,
                sort_order=sort_order,
            )
            db.add(folder)
            await db.flush()
            tag_ids = await _resolve_tag_ids(db, library_id, spec.tags, tag_cache)
            await _sync_folder_tags(db, folder.id, tag_ids)
            key_to_folder_id[spec.key] = folder.id
            created_folders += 1
            pending.pop(i)
            progressed = True
            break
        if not progressed:
            errors.append("文件夹树存在无效 parent_key 或循环引用")
            break

    existing_urls = await _existing_github_urls(db, library_id) if skip_duplicate_github_url else set()

    now = _utcnow()
    for pspec in bundle.projects:
        if skip_duplicate_github_url and pspec.github_url in existing_urls:
            skipped_projects += 1
            continue
        folder_id: int | None = None
        if pspec.folder_key is not None:
            folder_id = key_to_folder_id.get(pspec.folder_key)
            if folder_id is None:
                errors.append(f"项目 {pspec.key} 的 folder_key 未解析")
                continue
        if pspec.state not in PROJECT_STATES:
            errors.append(f"项目 {pspec.key} 的 state 无效，已用「未体验」")
            state = "未体验"
        else:
            state = pspec.state
        project = Project(
            project_library_id=library_id,
            folder_id=folder_id,
            github_url=pspec.github_url.strip(),
            name=pspec.name.strip(),
            full_name=pspec.full_name.strip(),
            description=pspec.description,
            stars=pspec.stars,
            language=pspec.language,
            author=pspec.author,
            license=pspec.license,
            ai_summary=pspec.ai_summary,
            notes=pspec.notes,
            deploy_methods=pspec.deploy_methods,
            state=state,
            state_changed_at=now if state != "未体验" else None,
            created_at=now,
            updated_at=now,
        )
        db.add(project)
        await db.flush()
        tag_ids = await _resolve_tag_ids(db, library_id, pspec.tags, tag_cache)
        await _sync_project_tags(db, project.id, tag_ids)
        created_projects += 1
        if skip_duplicate_github_url:
            existing_urls.add(pspec.github_url)

    await db.commit()
    return FolderBundleImportResult(
        created_folders=created_folders,
        created_projects=created_projects,
        skipped_projects=skipped_projects,
        errors=errors,
    )

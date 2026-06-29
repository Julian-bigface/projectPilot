"""内容工厂 — 推荐草稿 API（按 project_library 隔离）。"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_project_library
from app.core.database import get_db
from app.models.content_factory_draft import ContentFactoryDraft
from app.models.project import Project
from app.models.project_library import ProjectLibrary
from app.schemas.content_factory import (
    ContentFactoryDraftCreate,
    ContentFactoryDraftRead,
    ContentFactoryDraftUpdate,
    CoverStyleForkRequest,
    CoverStyleGenerateRequest,
    CoverStyleListResponse,
    CoverStylePatch,
    CoverStylePreviewRequest,
    CoverStylePreviewResponse,
    CoverStyleRead,
    CoverStyleReferenceUploadResponse,
    CoverStyleRefinePromptTemplateRequest,
    CoverStyleRefinePromptTemplateResponse,
    CoverStyleRefineRequest,
    CoverStyleRefineResponse,
    CoverStyleRevisionCreateRequest,
    CoverStyleRevisionListResponse,
    CoverStyleRevisionRead,
    CoverStyleRevisionSummary,
    CoverStyleSaveParsedRequest,
    CoverStyleWrite,
    GenerateAiCoverRequest,
    GenerateCopyRequest,
    GenerateCopyResponse,
    RevealCoverResponse,
    UploadCoverResponse,
    OptimizeSelectionRequest,
    OptimizeSelectionResponse,
    ColorTokensRead,
    FontTokensRead,
)
from app.services.content_factory_copy import (
    draft_to_read,
    generate_single_project_copy,
    get_draft_with_project,
    optimize_selected_copy,
)
from app.services.cover_prompt import CoverPromptError, build_cover_prompt
from app.services.cover_variants import (
    cover_variant_record,
    get_cover_variant,
    merge_body_json_cover_variants,
    resolve_cover_path_for_request,
    upsert_cover_variant,
)
from app.services.cover_style_registry import list_resolved_styles, resolve_style
from app.services.cover_style_store import (
    CoverStyleStoreError,
    count_styles_referencing_asset_path,
    create_style,
    delete_style,
    generate_style_id,
    get_style_row,
    set_builtin_hidden,
    update_style,
)
from app.services.cover_style_refine import refine_cover_style, refine_prompt_template
from app.services.cover_style_revision import (
    CoverStyleRevisionError,
    CoverStyleRevisionSnapshot,
    create_revision_after_ai_refine,
    delete_revision,
    get_revision,
    list_revisions,
    revision_created_at_iso,
    revision_snapshot_from_row,
)
from app.services.cover_style_design_analysis import CoverStyleDesignAnalysis
from app.services.cover_style_generate import (
    CoverStyleGenerateError,
    GeneratedCoverStylePayload,
    generate_cover_style_payload,
    iter_cover_style_generate_stream,
    save_generated_style,
)
from app.services.cover_style_example_image import (
    CoverStyleExampleError,
    generate_style_example_image,
)
from app.services.cover_style_presets import ColorTokens, CoverStylePreset, FontTokens, is_builtin_style_id
from app.services.llm.provider import LlmError
from app.services.recommend_image import ImageProviderError, generate_image_bytes
from app.services.settings_ai import resolve_ai_runtime_config
from app.services.reveal_in_folder import RevealInFolderError, reveal_file_in_folder
from app.services.readme_cover_storage import (
    ReadmeCoverError,
    clone_style_example_image,
    clone_style_reference_image,
    cover_absolute_path,
    cover_api_path,
    cover_generated_at_iso,
    load_reference_bytes,
    reference_upload_media_type,
    reference_upload_relative_path,
    save_ai_cover_png,
    save_cover_png,
    save_reference_upload,
    save_style_example_png,
    style_example_relative_path,
    style_reference_relative_path,
)

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def _unlink_style_asset_if_unreferenced(
    db: AsyncSession,
    *,
    style_id: str,
    relative_path: str | None,
) -> None:
    if not relative_path or not relative_path.strip():
        return
    path = relative_path.strip()
    others = await count_styles_referencing_asset_path(db, path=path, exclude_style_id=style_id)
    if others > 0:
        return
    absolute = cover_absolute_path(path)
    if absolute.is_file():
        absolute.unlink(missing_ok=True)


async def _get_project_in_library(
    db: AsyncSession,
    *,
    library_id: int,
    project_id: int,
) -> Project:
    project = await db.get(Project, project_id)
    if (
        project is None
        or project.project_library_id != library_id
        or project.deleted_at is not None
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    return project


@router.get("/drafts", response_model=list[ContentFactoryDraftRead])
async def list_content_factory_drafts(
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> list[ContentFactoryDraftRead]:
    stmt = (
        select(ContentFactoryDraft, Project)
        .join(Project, Project.id == ContentFactoryDraft.project_id)
        .where(
            ContentFactoryDraft.project_library_id == library.id,
            Project.deleted_at.is_(None),
        )
        .order_by(ContentFactoryDraft.updated_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [draft_to_read(draft, project) for draft, project in rows]


@router.post("/drafts", response_model=ContentFactoryDraftRead, status_code=status.HTTP_201_CREATED)
async def create_content_factory_draft(
    body: ContentFactoryDraftCreate,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> ContentFactoryDraftRead:
    project = await _get_project_in_library(db, library_id=library.id, project_id=body.project_id)
    draft = ContentFactoryDraft(
        project_library_id=library.id,
        project_id=project.id,
        kind="single",
        platform=body.platform,
        title=f"{project.name} 推荐稿",
        step=1,
        status="draft",
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft_to_read(draft, project)


@router.get("/drafts/{draft_id}", response_model=ContentFactoryDraftRead)
async def get_content_factory_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> ContentFactoryDraftRead:
    pair = await get_draft_with_project(db, library_id=library.id, draft_id=draft_id)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    draft, project = pair
    return draft_to_read(draft, project)


@router.patch("/drafts/{draft_id}", response_model=ContentFactoryDraftRead)
async def patch_content_factory_draft(
    draft_id: int,
    body: ContentFactoryDraftUpdate,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> ContentFactoryDraftRead:
    pair = await get_draft_with_project(db, library_id=library.id, draft_id=draft_id)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    draft, project = pair

    payload = body.model_dump(exclude_unset=True)
    if "body_json" in payload and payload["body_json"] is not None:
        bj = payload["body_json"]
        if hasattr(bj, "model_dump"):
            bj = bj.model_dump()
        payload["body_json"] = merge_body_json_cover_variants(draft.body_json, bj)
    for key, value in payload.items():
        setattr(draft, key, value)
    draft.updated_at = _utcnow()
    await db.commit()
    await db.refresh(draft)
    return draft_to_read(draft, project)


@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_factory_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> None:
    draft = await db.get(ContentFactoryDraft, draft_id)
    if draft is None or draft.project_library_id != library.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    await db.delete(draft)
    await db.commit()


@router.post("/drafts/{draft_id}/generate-copy", response_model=GenerateCopyResponse)
async def post_generate_copy(
    draft_id: int,
    body: GenerateCopyRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> GenerateCopyResponse:
    pair = await get_draft_with_project(db, library_id=library.id, draft_id=draft_id)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    draft, project = pair

    try:
        copy, updated = await generate_single_project_copy(
            db,
            draft=draft,
            project=project,
            preview_only=body.preview_only,
            platform=body.platform,
            from_source=body.from_source,
            regenerate=body.regenerate,
        )
    except LlmError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err

    draft_read = draft_to_read(updated, project) if updated is not None else None
    return GenerateCopyResponse(
        draft=draft_read,
        generated_copy=copy,
        preview_only=body.preview_only,
    )


@router.post(
    "/drafts/{draft_id}/optimize-selection",
    response_model=OptimizeSelectionResponse,
)
async def post_optimize_selection(
    draft_id: int,
    body: OptimizeSelectionRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> OptimizeSelectionResponse:
    pair = await get_draft_with_project(db, library_id=library.id, draft_id=draft_id)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    draft, _project = pair

    try:
        optimized = await optimize_selected_copy(
            db,
            draft=draft,
            selected_text=body.selected_text,
            full_body=body.full_body,
        )
    except LlmError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err

    return OptimizeSelectionResponse(optimized_text=optimized)


def _cover_url_with_variant(
    *,
    library_id: int,
    draft_id: int,
    style_id: str,
    size_preset_id: str,
    cache_bust: int,
) -> str:
    return (
        f"{cover_api_path(library_id=library_id, draft_id=draft_id)}"
        f"?style_id={style_id}&size_preset_id={size_preset_id}&t={cache_bust}"
    )


def _merge_cover_into_body_json(
    body_json: dict | None,
    *,
    cover_image_path: str,
    cover_readme_sha: str,
    size_preset_id: str,
) -> dict:
    generated_at = cover_generated_at_iso()
    record = cover_variant_record(
        cover_image_path=cover_image_path,
        cover_source="readme_capture",
        style_id="native-readme",
        size_preset_id=size_preset_id,
        cover_readme_sha=cover_readme_sha,
        cover_generated_at=generated_at,
    )
    merged = upsert_cover_variant(
        body_json,
        style_id="native-readme",
        size_preset_id=size_preset_id,
        record=record,
    )
    merged["cover_style_source"] = None
    merged["cover_prompt_hash"] = None
    merged["cover_prompt_record"] = None
    return merged


def _merge_ai_cover_into_body_json(
    body_json: dict | None,
    *,
    cover_image_path: str,
    style_id: str,
    size_preset_id: str,
    prompt_hash: str,
    image_prompt: str,
    negative_prompt: str,
    cover_style_source: str,
) -> dict:
    generated_at = cover_generated_at_iso()
    record = cover_variant_record(
        cover_image_path=cover_image_path,
        cover_source="ai_generated",
        style_id=style_id,
        size_preset_id=size_preset_id,
        cover_prompt_hash=prompt_hash,
        cover_generated_at=generated_at,
    )
    merged = upsert_cover_variant(
        body_json,
        style_id=style_id,
        size_preset_id=size_preset_id,
        record=record,
    )
    merged["cover_style_source"] = cover_style_source
    merged["cover_prompt_record"] = {
        "image_prompt": image_prompt,
        "negative_prompt": negative_prompt,
        "prompt_hash": prompt_hash,
        "style_id": style_id,
    }
    return merged


def _ai_cover_variant_needs_persist(
    body_json: dict | None,
    *,
    style_id: str,
    size_preset_id: str,
    relative_path: str,
    prompt_hash: str,
) -> bool:
    variant = get_cover_variant(body_json, style_id=style_id, size_preset_id=size_preset_id)
    if variant is None:
        return True
    path = variant.get("cover_image_path")
    if not isinstance(path, str) or path.strip() != relative_path:
        return True
    stored_hash = variant.get("cover_prompt_hash")
    return not isinstance(stored_hash, str) or stored_hash != prompt_hash


def _heal_orphan_ai_cover_variant(
    body_json: dict | None,
    *,
    style_id: str,
    size_preset_id: str,
    relative_path: str,
) -> dict:
    record = cover_variant_record(
        cover_image_path=relative_path,
        cover_source="ai_generated",
        style_id=style_id,
        size_preset_id=size_preset_id,
        cover_generated_at=cover_generated_at_iso(),
    )
    return upsert_cover_variant(
        body_json,
        style_id=style_id,
        size_preset_id=size_preset_id,
        record=record,
    )


async def _resolve_draft_cover_relative(
    db: AsyncSession,
    draft,
    *,
    library_id: int,
    style_id: str | None,
    size_preset_id: str | None,
    heal_orphan: bool,
) -> str | None:
    body_json = draft.body_json or {}
    style = style_id
    if not style:
        raw_style = body_json.get("image_template")
        style = raw_style if isinstance(raw_style, str) and raw_style.strip() else "native-readme"
    size = size_preset_id
    if not size:
        raw_size = body_json.get("cover_size_preset_id")
        size = raw_size if isinstance(raw_size, str) and raw_size.strip() else "xiaohongshu-34"
    variant_before = get_cover_variant(body_json, style_id=style, size_preset_id=size)
    relative = resolve_cover_path_for_request(
        body_json,
        style_id=style_id,
        size_preset_id=size_preset_id,
        library_id=library_id,
        draft_id=draft.id,
    )
    if heal_orphan and relative and variant_before is None and style != "native-readme":
        draft.body_json = _heal_orphan_ai_cover_variant(
            body_json,
            style_id=style,
            size_preset_id=size,
            relative_path=relative,
        )
        draft.updated_at = _utcnow()
        await db.commit()
    return relative


def _style_revision_example_api_path(
    *, library_id: int, style_id: str, revision_id: int
) -> str:
    return (
        f"/api/project-libraries/{library_id}/content-factory/cover-styles/"
        f"{style_id}/revisions/{revision_id}/example"
    )


def _revision_to_summary(
    row,
    *,
    library_id: int,
    style_id: str,
    cache_bust: int | None = None,
) -> CoverStyleRevisionSummary:
    example_url: str | None = None
    if row.example_image_path:
        bust = cache_bust if cache_bust is not None else int(_utcnow().timestamp())
        example_url = (
            f"{_style_revision_example_api_path(library_id=library_id, style_id=style_id, revision_id=row.id)}"
            f"?t={bust}"
        )
    return CoverStyleRevisionSummary(
        id=row.id,
        revision_index=row.revision_index,
        source=row.source,
        instruction=row.instruction,
        created_at=revision_created_at_iso(row),
        example_image_url=example_url,
    )


def _revision_to_read(
    row,
    *,
    library_id: int,
    style_id: str,
    cache_bust: int | None = None,
) -> CoverStyleRevisionRead:
    snapshot = revision_snapshot_from_row(row)
    example_url: str | None = None
    if row.example_image_path:
        bust = cache_bust if cache_bust is not None else int(_utcnow().timestamp())
        example_url = (
            f"{_style_revision_example_api_path(library_id=library_id, style_id=style_id, revision_id=row.id)}"
            f"?t={bust}"
        )
    return CoverStyleRevisionRead(
        id=row.id,
        revision_index=row.revision_index,
        source=row.source,
        instruction=row.instruction,
        created_at=revision_created_at_iso(row),
        design_analysis=snapshot.design_analysis,
        prompt_prefix=snapshot.prompt_prefix,
        prompt_template=snapshot.prompt_template,
        negative_prompt=snapshot.negative_prompt,
        color_tokens=ColorTokensRead.model_validate(snapshot.color_tokens.model_dump()),
        font_tokens=FontTokensRead.model_validate(snapshot.font_tokens.model_dump()),
        style_report=snapshot.style_report,
        example_image_url=example_url,
    )


def _style_example_api_path(*, library_id: int, style_id: str) -> str:
    return (
        f"/api/project-libraries/{library_id}/content-factory/cover-styles/{style_id}/example"
    )


def _style_reference_api_path(*, library_id: int, style_id: str) -> str:
    return (
        f"/api/project-libraries/{library_id}/content-factory/cover-styles/{style_id}/reference"
    )


def _reference_preview_api_path(*, library_id: int, reference_id: str) -> str:
    return (
        f"/api/project-libraries/{library_id}/content-factory/cover-styles/references/{reference_id}"
    )


def _style_to_read(
    resolved,
    *,
    library_id: int,
    cache_bust: int | None = None,
) -> CoverStyleRead:
    preset = resolved.preset
    example_url: str | None = None
    reference_url: str | None = None
    if resolved.example_image_path:
        bust = cache_bust if cache_bust is not None else int(_utcnow().timestamp())
        example_url = f"{_style_example_api_path(library_id=library_id, style_id=preset.id)}?t={bust}"
    if resolved.reference_image_path:
        bust = cache_bust if cache_bust is not None else int(_utcnow().timestamp())
        reference_url = (
            f"{_style_reference_api_path(library_id=library_id, style_id=preset.id)}?t={bust}"
        )
    return CoverStyleRead(
        id=preset.id,
        label=preset.label,
        source=preset.source,
        prompt_prefix=preset.prompt_prefix,
        prompt_template=preset.prompt_template,
        negative_prompt=preset.negative_prompt,
        color_tokens=ColorTokensRead.model_validate(preset.color_tokens.model_dump()),
        font_tokens=FontTokensRead.model_validate(preset.font_tokens.model_dump()),
        style_report=resolved.style_report,
        design_analysis=resolved.design_analysis,
        example_image_url=example_url,
        reference_image_url=reference_url,
        fork_from_style_id=resolved.fork_from_style_id,
        hidden=resolved.hidden,
        is_deletable=resolved.is_deletable,
        created_at=resolved.created_at,
    )


@router.get("/cover-styles", response_model=CoverStyleListResponse)
async def list_cover_styles(
    include_hidden: bool = False,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleListResponse:
    resolved_list = await list_resolved_styles(
        db, library_id=library.id, include_hidden=include_hidden
    )
    cache_bust = int(_utcnow().timestamp())
    return CoverStyleListResponse(
        items=[
            _style_to_read(item, library_id=library.id, cache_bust=cache_bust)
            for item in resolved_list
        ]
    )


@router.post("/cover-styles/reference-upload", response_model=CoverStyleReferenceUploadResponse)
async def post_cover_style_reference_upload(
    file: UploadFile = File(...),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleReferenceUploadResponse:
    raw = await file.read()
    try:
        reference_id, _relative = save_reference_upload(raw)
    except ReadmeCoverError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    preview_url = _reference_preview_api_path(library_id=library.id, reference_id=reference_id)
    return CoverStyleReferenceUploadResponse(
        reference_id=reference_id,
        preview_url=preview_url,
    )


@router.get("/cover-styles/references/{reference_id}")
async def get_cover_style_reference_upload(
    reference_id: str,
    library: ProjectLibrary = Depends(get_project_library),
) -> FileResponse:
    del library
    try:
        _data, mime = load_reference_bytes(reference_id)
    except ReadmeCoverError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    for ext in ("png", "jpg", "webp"):
        relative = reference_upload_relative_path(reference_id=reference_id, ext=ext)
        absolute = cover_absolute_path(relative)
        if absolute.is_file():
            return FileResponse(
                path=str(absolute),
                media_type=mime,
                filename=f"{reference_id}.{ext}",
            )
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="参考图不存在")


@router.post("/cover-styles/generate/stream")
async def post_generate_cover_style_stream(
    body: CoverStyleGenerateRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> StreamingResponse:
    """NDJSON 流式解析封面风格（delta 为 LLM 文本增量，done 含完整 payload）。"""

    async def generate():
        async for event in iter_cover_style_generate_stream(
            db,
            library_id=library.id,
            generation_brief=body.generation_brief,
            fork_from_style_id=body.fork_from_style_id,
            reference_id=body.reference_id,
        ):
            yield (json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8")

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post(
    "/cover-styles/refine-prompt-template",
    response_model=CoverStyleRefinePromptTemplateResponse,
)
async def post_refine_cover_style_prompt_template(
    body: CoverStyleRefinePromptTemplateRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRefinePromptTemplateResponse:
    del library
    try:
        revised = await refine_prompt_template(
            db,
            prompt_template=body.prompt_template,
            instruction=body.instruction,
            prompt_prefix=body.prompt_prefix,
        )
    except CoverStyleGenerateError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    return CoverStyleRefinePromptTemplateResponse(prompt_template=revised)


@router.post("/cover-styles/refine", response_model=CoverStyleRefineResponse)
async def post_refine_cover_style(
    body: CoverStyleRefineRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRefineResponse:
    del library
    try:
        result = await refine_cover_style(
            db,
            instruction=body.instruction,
            label=body.label,
            design_analysis=body.design_analysis,
            prompt_prefix=body.prompt_prefix,
            prompt_template=body.prompt_template,
            negative_prompt=body.negative_prompt,
            color_tokens=ColorTokens.model_validate(body.color_tokens.model_dump()),
            font_tokens=FontTokens.model_validate(body.font_tokens.model_dump()),
            style_report=body.style_report,
        )
    except CoverStyleGenerateError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    return CoverStyleRefineResponse(
        design_analysis=result.design_analysis,
        prompt_prefix=result.prompt_prefix,
        prompt_template=result.prompt_template,
        negative_prompt=result.negative_prompt,
        color_tokens=ColorTokensRead.model_validate(result.color_tokens.model_dump()),
        font_tokens=FontTokensRead.model_validate(result.font_tokens.model_dump()),
        style_report=result.style_report,
    )


@router.get(
    "/cover-styles/{style_id}/revisions",
    response_model=CoverStyleRevisionListResponse,
)
async def get_cover_style_revisions(
    style_id: str,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRevisionListResponse:
    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="风格不存在")
    rows = await list_revisions(db, style_id=style_id)
    bust = int(_utcnow().timestamp())
    return CoverStyleRevisionListResponse(
        items=[
            _revision_to_summary(row, library_id=library.id, style_id=style_id, cache_bust=bust)
            for row in rows
        ]
    )


@router.get(
    "/cover-styles/{style_id}/revisions/{revision_id}",
    response_model=CoverStyleRevisionRead,
)
async def get_cover_style_revision(
    style_id: str,
    revision_id: int,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRevisionRead:
    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="风格不存在")
    row = await get_revision(db, style_id=style_id, revision_id=revision_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")
    return _revision_to_read(row, library_id=library.id, style_id=style_id)


@router.post(
    "/cover-styles/{style_id}/revisions",
    response_model=CoverStyleRevisionRead,
    status_code=status.HTTP_201_CREATED,
)
async def post_cover_style_revision(
    style_id: str,
    body: CoverStyleRevisionCreateRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRevisionRead:
    try:
        snapshot = CoverStyleRevisionSnapshot(
            design_analysis=body.design_analysis,
            prompt_prefix=body.prompt_prefix.strip(),
            prompt_template=body.prompt_template.strip(),
            negative_prompt=body.negative_prompt.strip(),
            color_tokens=ColorTokens.model_validate(body.color_tokens.model_dump()),
            font_tokens=FontTokens.model_validate(body.font_tokens.model_dump()),
            style_report=(body.style_report or "").strip() or None,
        )
        row = await create_revision_after_ai_refine(
            db,
            library_id=library.id,
            style_id=style_id,
            instruction=body.instruction,
            snapshot=snapshot,
        )
        await db.commit()
        await db.refresh(row)
    except CoverStyleRevisionError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    return _revision_to_read(row, library_id=library.id, style_id=style_id)


@router.delete(
    "/cover-styles/{style_id}/revisions/{revision_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_cover_style_revision(
    style_id: str,
    revision_id: int,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> None:
    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    del library
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="风格不存在")
    deleted = await delete_revision(db, style_id=style_id, revision_id=revision_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")
    await db.commit()


@router.get("/cover-styles/{style_id}/revisions/{revision_id}/example")
async def get_cover_style_revision_example(
    style_id: str,
    revision_id: int,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> FileResponse:
    del library
    row = await get_revision(db, style_id=style_id, revision_id=revision_id)
    if row is None or not row.example_image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本示例图不存在")
    absolute = cover_absolute_path(row.example_image_path)
    if not absolute.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本示例图文件不存在")
    return FileResponse(
        path=str(absolute),
        media_type="image/png",
        filename=f"style-{style_id}-revision-{revision_id}.png",
    )


@router.post("/cover-styles/save-parsed", response_model=CoverStyleRead)
async def post_save_parsed_cover_style(
    body: CoverStyleSaveParsedRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRead:
    payload = GeneratedCoverStylePayload(
        name=body.name.strip(),
        design_analysis=body.design_analysis or CoverStyleDesignAnalysis(),
        prompt_prefix=body.prompt_prefix.strip(),
        prompt_template=body.prompt_template.strip(),
        negative_prompt=body.negative_prompt.strip(),
        color_tokens=ColorTokens.model_validate(body.color_tokens.model_dump()),
        font_tokens=FontTokens.model_validate(body.font_tokens.model_dump()),
        style_report=(body.style_report or "").strip(),
    )
    try:
        style_id, _label = await save_generated_style(
            db,
            library_id=library.id,
            payload=payload,
            fork_from_style_id=body.fork_from_style_id,
            reference_id=body.reference_id,
        )
        await db.commit()
    except CoverStyleGenerateError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    if body.generate_example:
        try:
            await generate_style_example_image(
                db,
                library_id=library.id,
                style_id=style_id,
                force=True,
            )
            await db.commit()
        except CoverStyleExampleError as err:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_424_FAILED_DEPENDENCY,
                detail=f"风格已保存，但示例图生成失败：{err}",
            ) from err

    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    assert resolved is not None
    return _style_to_read(resolved, library_id=library.id)


@router.post("/cover-styles/generate", response_model=CoverStyleRead)
async def post_generate_cover_style(
    body: CoverStyleGenerateRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRead:
    try:
        payload = await generate_cover_style_payload(
            db,
            library_id=library.id,
            generation_brief=body.generation_brief,
            fork_from_style_id=body.fork_from_style_id,
            reference_id=body.reference_id,
        )
    except CoverStyleGenerateError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err

    if not body.auto_save:
        preset = CoverStylePreset(
            id="preview",
            label=payload.name,
            source="ai_generated",
            prompt_prefix=payload.prompt_prefix,
            prompt_template=payload.prompt_template,
            negative_prompt=payload.negative_prompt,
            color_tokens=payload.color_tokens,
            font_tokens=payload.font_tokens,
            design_analysis=payload.design_analysis,
        )
        from app.services.cover_style_registry import ResolvedCoverStyle

        return _style_to_read(
            ResolvedCoverStyle(
                preset=preset,
                style_report=payload.style_report,
                design_analysis=payload.design_analysis,
                is_deletable=False,
            ),
            library_id=library.id,
        )

    try:
        style_id, _label = await save_generated_style(
            db,
            library_id=library.id,
            payload=payload,
            fork_from_style_id=body.fork_from_style_id,
            reference_id=body.reference_id,
        )
        await db.commit()
    except CoverStyleGenerateError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    if body.generate_example:
        try:
            await generate_style_example_image(
                db,
                library_id=library.id,
                style_id=style_id,
                force=True,
            )
            await db.commit()
        except CoverStyleExampleError as err:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_424_FAILED_DEPENDENCY,
                detail=f"风格已保存，但示例图生成失败：{err}",
            ) from err

    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    assert resolved is not None
    return _style_to_read(resolved, library_id=library.id)


@router.get("/cover-styles/{style_id}", response_model=CoverStyleRead)
async def get_cover_style(
    style_id: str,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRead:
    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    if resolved is None or resolved.hidden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="风格不存在")
    return _style_to_read(resolved, library_id=library.id)


@router.post("/cover-styles", response_model=CoverStyleRead, status_code=status.HTTP_201_CREATED)
async def post_cover_style(
    body: CoverStyleWrite,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRead:
    style_id = (body.style_id or "").strip() or generate_style_id(prefix="manual", label=body.label)
    try:
        color = ColorTokens.model_validate(body.color_tokens.model_dump())
        font = FontTokens.model_validate(body.font_tokens.model_dump())
        row = await create_style(
            db,
            library_id=library.id,
            style_id=style_id,
            label=body.label,
            source="manual",
            prompt_prefix=body.prompt_prefix,
            prompt_template=body.prompt_template,
            negative_prompt=body.negative_prompt,
            color_tokens=color,
            font_tokens=font,
            style_report=body.style_report,
            fork_from_style_id=body.fork_from_style_id,
        )
        await db.commit()
        await db.refresh(row)
    except CoverStyleStoreError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    assert resolved is not None
    return _style_to_read(resolved, library_id=library.id)


@router.patch("/cover-styles/{style_id}", response_model=CoverStyleRead)
async def patch_cover_style(
    style_id: str,
    body: CoverStylePatch,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRead:
    payload = body.model_dump(exclude_unset=True)
    hidden = payload.pop("hidden", None)

    if is_builtin_style_id(style_id):
        if payload and hidden is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="内置风格仅可修改 hidden。",
            )
        if hidden is not None:
            await set_builtin_hidden(
                db, library_id=library.id, style_id=style_id, hidden=hidden
            )
            await db.commit()
        resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
        if resolved is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="风格不存在")
        return _style_to_read(resolved, library_id=library.id)

    row = await get_style_row(db, library_id=library.id, style_id=style_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="风格不存在")

    color = (
        ColorTokens.model_validate(payload.pop("color_tokens"))
        if "color_tokens" in payload
        else None
    )
    font = (
        FontTokens.model_validate(payload.pop("font_tokens"))
        if "font_tokens" in payload
        else None
    )
    design_analysis = (
        CoverStyleDesignAnalysis.model_validate(payload.pop("design_analysis"))
        if "design_analysis" in payload
        else None
    )
    try:
        await update_style(
            db,
            row,
            label=payload.get("label"),
            prompt_prefix=payload.get("prompt_prefix"),
            prompt_template=payload.get("prompt_template"),
            negative_prompt=payload.get("negative_prompt"),
            color_tokens=color,
            font_tokens=font,
            style_report=payload.get("style_report"),
            design_analysis=design_analysis,
            hidden=hidden,
        )
        await db.commit()
        await db.refresh(row)
    except CoverStyleStoreError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    assert resolved is not None
    return _style_to_read(resolved, library_id=library.id)


@router.delete("/cover-styles/{style_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cover_style(
    style_id: str,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> None:
    if is_builtin_style_id(style_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="内置风格不可删除")
    try:
        row = await delete_style(db, library_id=library.id, style_id=style_id)
    except CoverStyleStoreError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="风格不存在")
    await _unlink_style_asset_if_unreferenced(
        db, style_id=style_id, relative_path=row.example_image_path
    )
    await _unlink_style_asset_if_unreferenced(
        db, style_id=style_id, relative_path=row.reference_image_path
    )
    await _unlink_style_asset_if_unreferenced(
        db,
        style_id=style_id,
        relative_path=style_example_relative_path(style_id=style_id),
    )
    await _unlink_style_asset_if_unreferenced(
        db,
        style_id=style_id,
        relative_path=style_reference_relative_path(style_id=style_id),
    )
    await db.commit()


@router.post("/cover-styles/{style_id}/preview", response_model=CoverStylePreviewResponse)
async def post_cover_style_preview(
    style_id: str,
    body: CoverStylePreviewRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStylePreviewResponse:
    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="风格不存在")
    try:
        await generate_style_example_image(
            db,
            library_id=library.id,
            style_id=style_id,
            size_preset_id=body.size_preset_id,
            force=body.force,
            prompt_prefix=body.prompt_prefix,
            prompt_template=body.prompt_template,
            negative_prompt=body.negative_prompt,
            design_analysis=body.design_analysis,
            color_tokens=(
                ColorTokens.model_validate(body.color_tokens.model_dump())
                if body.color_tokens is not None
                else None
            ),
            font_tokens=(
                FontTokens.model_validate(body.font_tokens.model_dump())
                if body.font_tokens is not None
                else None
            ),
        )
        await db.commit()
    except CoverStyleExampleError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err

    cache_bust = int(_utcnow().timestamp())
    return CoverStylePreviewResponse(
        style_id=style_id,
        example_image_url=f"{_style_example_api_path(library_id=library.id, style_id=style_id)}?t={cache_bust}",
    )


@router.post("/cover-styles/{style_id}/fork", response_model=CoverStyleRead, status_code=status.HTTP_201_CREATED)
async def post_fork_cover_style(
    style_id: str,
    body: CoverStyleForkRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> CoverStyleRead:
    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    if resolved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="源风格不存在")

    source_row = await get_style_row(db, style_id=style_id)
    label = (body.label or f"{resolved.preset.label}（副本）").strip()
    new_id = generate_style_id(prefix="manual", label=label)
    fork_example_path = clone_style_example_image(
        source_style_id=style_id,
        source_stored_path=source_row.example_image_path if source_row else None,
        target_style_id=new_id,
        library_id=library.id,
    )
    fork_reference_path = clone_style_reference_image(
        source_style_id=style_id,
        source_stored_path=source_row.reference_image_path if source_row else None,
        target_style_id=new_id,
    )
    try:
        await create_style(
            db,
            library_id=library.id,
            style_id=new_id,
            label=label,
            source="manual",
            prompt_prefix=resolved.preset.prompt_prefix,
            prompt_template=resolved.preset.prompt_template,
            negative_prompt=resolved.preset.negative_prompt,
            color_tokens=resolved.preset.color_tokens,
            font_tokens=resolved.preset.font_tokens,
            style_report=resolved.style_report,
            fork_from_style_id=style_id,
            example_image_path=fork_example_path,
            reference_image_path=fork_reference_path,
        )
        if body.hidden_source and resolved.is_builtin:
            await set_builtin_hidden(
                db, library_id=library.id, style_id=style_id, hidden=True
            )
        await db.commit()
    except CoverStyleStoreError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    forked = await resolve_style(db, library_id=library.id, style_id=new_id)
    assert forked is not None
    return _style_to_read(forked, library_id=library.id)


@router.get("/cover-styles/{style_id}/example")
async def get_cover_style_example(
    style_id: str,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> FileResponse:
    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    if resolved is None or not resolved.example_image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="示例图尚未生成")
    absolute = cover_absolute_path(resolved.example_image_path)
    if not absolute.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="示例图文件不存在")
    return FileResponse(
        path=str(absolute),
        media_type="image/png",
        filename=f"style-{style_id}-example.png",
    )


@router.get("/cover-styles/{style_id}/reference")
async def get_cover_style_reference(
    style_id: str,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> FileResponse:
    resolved = await resolve_style(db, library_id=library.id, style_id=style_id)
    if resolved is None or not resolved.reference_image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="灵感参考图不存在")
    absolute = cover_absolute_path(resolved.reference_image_path)
    if not absolute.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="灵感参考图文件不存在")
    return FileResponse(
        path=str(absolute),
        media_type=reference_upload_media_type(resolved.reference_image_path),
        filename=f"style-{style_id}-reference.png",
    )


@router.post("/drafts/{draft_id}/generate-ai-cover", response_model=UploadCoverResponse)
async def post_generate_ai_cover(
    draft_id: int,
    body: GenerateAiCoverRequest,
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> UploadCoverResponse:
    pair = await get_draft_with_project(db, library_id=library.id, draft_id=draft_id)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    draft, project = pair

    body_json = draft.body_json or {}
    variant = get_cover_variant(
        body_json,
        style_id=body.style_id,
        size_preset_id=body.size_preset_id,
    )

    resolved = await resolve_style(db, library_id=library.id, style_id=body.style_id)
    if resolved is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"未知封面风格：{body.style_id}",
        )

    try:
        built = build_cover_prompt(
            style_id=body.style_id,
            project=project,
            body_json=body_json,
            style=resolved.preset,
            size_preset_id=body.size_preset_id,
        )
    except CoverPromptError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    existing_hash = variant.get("cover_prompt_hash") if variant else None
    existing_path = variant.get("cover_image_path") if variant else None
    cache_hit = (
        not body.force
        and existing_hash == built.prompt_hash
        and isinstance(existing_path, str)
        and existing_path.strip()
    )
    if cache_hit:
        absolute = cover_absolute_path(existing_path)
        if absolute.is_file() and absolute.stat().st_size > 0:
            cache_bust = int(draft.updated_at.timestamp())
            cover_url = _cover_url_with_variant(
                library_id=library.id,
                draft_id=draft.id,
                style_id=body.style_id,
                size_preset_id=body.size_preset_id,
                cache_bust=cache_bust,
            )
            return UploadCoverResponse(
                cover_url=cover_url,
                draft=draft_to_read(draft, project),
                cached=True,
            )

    _provider, base_url, model, api_key = await resolve_ai_runtime_config(
        db,
        scenario_id="recommend_image",
    )
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail="未配置生图 API Key：请在设置 → AI → 推荐配图中配置 RootFlowAI 等供应商。",
        )

    try:
        png_bytes = await generate_image_bytes(
            base_url=base_url,
            api_key=api_key,
            model=model,
            prompt=built.image_prompt,
            size_preset_id=body.size_preset_id,
            negative_prompt=built.negative_prompt,
        )
    except ImageProviderError as err:
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(err),
        ) from err

    try:
        relative_path, cached = save_ai_cover_png(
            png_bytes,
            library_id=library.id,
            draft_id=draft.id,
            project_name=project.name,
            style_id=body.style_id,
            size_preset_id=body.size_preset_id,
            prompt_hash=built.prompt_hash,
            force=body.force,
            existing_prompt_hash=existing_hash if isinstance(existing_hash, str) else None,
            existing_cover_path=existing_path if isinstance(existing_path, str) else None,
        )
    except ReadmeCoverError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        ) from err

    if not cached or _ai_cover_variant_needs_persist(
        draft.body_json,
        style_id=body.style_id,
        size_preset_id=body.size_preset_id,
        relative_path=relative_path,
        prompt_hash=built.prompt_hash,
    ):
        draft.body_json = _merge_ai_cover_into_body_json(
            draft.body_json,
            cover_image_path=relative_path,
            style_id=body.style_id,
            size_preset_id=body.size_preset_id,
            prompt_hash=built.prompt_hash,
            image_prompt=built.image_prompt,
            negative_prompt=built.negative_prompt,
            cover_style_source=resolved.preset.source,
        )
        draft.updated_at = _utcnow()
        await db.commit()
        await db.refresh(draft)

    cache_bust = int(draft.updated_at.timestamp())
    cover_url = _cover_url_with_variant(
        library_id=library.id,
        draft_id=draft.id,
        style_id=body.style_id,
        size_preset_id=body.size_preset_id,
        cache_bust=cache_bust,
    )
    return UploadCoverResponse(
        cover_url=cover_url,
        draft=draft_to_read(draft, project),
        cached=cached,
    )


@router.post("/drafts/{draft_id}/upload-cover", response_model=UploadCoverResponse)
async def post_upload_cover(
    draft_id: int,
    file: UploadFile = File(...),
    readme_sha: str = Form(default="unknown"),
    size_preset_id: str = Form(default="xiaohongshu-34"),
    force: bool = Form(default=False),
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> UploadCoverResponse:
    pair = await get_draft_with_project(db, library_id=library.id, draft_id=draft_id)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    draft, project = pair

    file_bytes = await file.read()
    body_json = draft.body_json or {}
    sha = (readme_sha or "unknown").strip() or "unknown"
    size_id = (size_preset_id or "xiaohongshu-34").strip() or "xiaohongshu-34"
    variant = get_cover_variant(
        body_json,
        style_id="native-readme",
        size_preset_id=size_id,
    )
    existing_sha = variant.get("cover_readme_sha") if variant else None
    existing_path = variant.get("cover_image_path") if variant else None

    try:
        relative_path, cached = save_cover_png(
            file_bytes,
            library_id=library.id,
            draft_id=draft.id,
            project_name=project.name,
            style_id="native-readme",
            size_preset_id=size_id,
            readme_sha=sha,
            force=force,
            existing_readme_sha=existing_sha if isinstance(existing_sha, str) else None,
            existing_cover_path=existing_path if isinstance(existing_path, str) else None,
        )
    except ReadmeCoverError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        ) from err

    if not cached:
        draft.body_json = _merge_cover_into_body_json(
            draft.body_json,
            cover_image_path=relative_path,
            cover_readme_sha=sha,
            size_preset_id=size_id,
        )
        draft.updated_at = _utcnow()
        await db.commit()
        await db.refresh(draft)

    cache_bust = int(draft.updated_at.timestamp())
    cover_url = _cover_url_with_variant(
        library_id=library.id,
        draft_id=draft.id,
        style_id="native-readme",
        size_preset_id=size_id,
        cache_bust=cache_bust,
    )
    return UploadCoverResponse(
        cover_url=cover_url,
        draft=draft_to_read(draft, project),
        cached=cached,
    )


@router.get("/drafts/{draft_id}/cover")
async def get_content_factory_cover(
    draft_id: int,
    style_id: str | None = Query(default=None),
    size_preset_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> FileResponse:
    pair = await get_draft_with_project(db, library_id=library.id, draft_id=draft_id)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    draft, _project = pair
    relative = await _resolve_draft_cover_relative(
        db,
        draft,
        library_id=library.id,
        style_id=style_id,
        size_preset_id=size_preset_id,
        heal_orphan=True,
    )
    if not relative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="封面尚未生成")
    absolute = cover_absolute_path(relative)
    if not absolute.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="封面文件不存在")
    return FileResponse(
        path=str(absolute),
        media_type="image/png",
        filename=f"cover-{draft_id}.png",
    )


@router.post("/drafts/{draft_id}/reveal-cover", response_model=RevealCoverResponse)
async def post_reveal_content_factory_cover(
    draft_id: int,
    style_id: str | None = Query(default=None),
    size_preset_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    library: ProjectLibrary = Depends(get_project_library),
) -> RevealCoverResponse:
    """在系统文件管理器中定位封面 PNG（选中文件）。"""
    pair = await get_draft_with_project(db, library_id=library.id, draft_id=draft_id)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="草稿不存在")
    draft, _project = pair
    relative = await _resolve_draft_cover_relative(
        db,
        draft,
        library_id=library.id,
        style_id=style_id,
        size_preset_id=size_preset_id,
        heal_orphan=False,
    )
    if not relative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="封面尚未生成")
    absolute = cover_absolute_path(relative)
    if not absolute.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="封面文件不存在")
    try:
        reveal_file_in_folder(absolute)
    except RevealInFolderError as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        ) from err
    return RevealCoverResponse(
        absolute_path=str(absolute.resolve()),
        directory=str(absolute.resolve().parent),
    )

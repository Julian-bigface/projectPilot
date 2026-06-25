"""内容工厂 — 单项目推荐文案生成。"""

from __future__ import annotations

from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content_factory_draft import ContentFactoryDraft
from app.models.project import Project
from app.schemas.content_factory import ContentFactoryCopyJson, ContentFactoryDraftRead
from app.services.llm import get_llm_provider
from app.services.llm.json_extract import extract_first_json_object
from app.services.llm.provider import LlmError, LlmProvider
from app.services.settings_ai import resolve_ai_runtime_config

_PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts" / "content_factory"
_PROMPT_PATH = _PROMPT_DIR / "single_project.txt"
_LAYOUT_FROM_SOURCE_PROMPT_PATH = _PROMPT_DIR / "layout_from_source.txt"
_REGENERATE_PLATFORM_PROMPT_PATH = _PROMPT_DIR / "regenerate_platform.txt"
_OPTIMIZE_SELECTION_PROMPT_PATH = _PROMPT_DIR / "optimize_selection.txt"

_PLATFORM_LABELS = {
    "xiaohongshu": "小红书",
    "wechat": "微信公众号",
    "twitter": "Twitter / X",
    "linkedin": "LinkedIn",
}

_PLATFORM_STYLE_HINTS = {
    "xiaohongshu": (
        "小红书：标题抓眼球、短句口语、适度 emoji、分点列干货、结尾可带话题标签，"
        "避免长段论文式叙述。"
    ),
    "wechat": (
        "微信公众号：标题正式有信息量、段落层次清晰、论述完整可读，"
        "偏专业沉淀，少用 emoji，避免过于口语化的网络梗。"
    ),
    "twitter": (
        "Twitter / X：极简有力、单条信息密度高、可拆短句与要点，"
        "避免公众号式长段落，标题与正文都要短。"
    ),
    "linkedin": (
        "LinkedIn：偏职场与技术价值表达，强调能力、场景、收益与可信度，"
        "语气专业克制，避免过度娱乐化。"
    ),
}


def _parse_copy_json(raw: str) -> ContentFactoryCopyJson:
    try:
        data = extract_first_json_object(raw)
        return ContentFactoryCopyJson.model_validate(data)
    except ValidationError as err:
        raise LlmError(f"LLM JSON 结构无效：{err}") from err


def _build_project_context(project: Project) -> str:
    desc = project.description_translated or project.description or "(无简介)"
    topics = ", ".join(project.topics or []) or "(无 topics)"
    notes = (project.notes or "").strip() or "(无用户笔记)"
    ai_summary = (project.ai_summary or "").strip() or "(无手动摘要)"
    lines = [
        f"- 名称：{project.name}",
        f"- 仓库：{project.full_name}",
        f"- Stars：{project.stars}",
        f"- 语言：{project.language or '(未知)'}",
        f"- 简介：{desc}",
        f"- Topics：{topics}",
        f"- 用户笔记：{notes}",
        f"- 手动摘要：{ai_summary}",
    ]
    return "\n".join(lines)


def _load_prompt_template() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def _load_layout_from_source_template() -> str:
    return _LAYOUT_FROM_SOURCE_PROMPT_PATH.read_text(encoding="utf-8")


def _load_regenerate_platform_template() -> str:
    return _REGENERATE_PLATFORM_PROMPT_PATH.read_text(encoding="utf-8")


def _platform_style_hint(platform: str) -> str:
    return _PLATFORM_STYLE_HINTS.get(platform, "按目标平台常见内容习惯撰写。")


def _read_source_from_body_json(body_json: dict | None) -> tuple[str, str]:
    if not body_json:
        return "", ""
    title = body_json.get("source_title")
    body = body_json.get("source_body")
    return (
        title.strip() if isinstance(title, str) else "",
        body.strip() if isinstance(body, str) else "",
    )


def _merge_generated_into_body_json(
    existing: dict | None,
    *,
    platform: str,
    copy: ContentFactoryCopyJson,
) -> dict:
    base = dict(existing or {})
    gen_dump = copy.model_dump()
    variants = dict(base.get("platform_variants") or {})
    title = copy.title_options[0] if copy.title_options else None
    variants[platform] = {
        "title": title,
        "body": copy.body,
        "title_options": copy.title_options,
        "highlight_tags": copy.highlight_tags,
    }
    base["platform_variants"] = variants
    for key in ("title_options", "hashtags", "highlight_tags", "hook", "cover_texts", "cta"):
        if key in gen_dump:
            base[key] = gen_dump[key]
    return base


async def _get_llm(db: AsyncSession) -> LlmProvider:
    provider_name, base_url, model, api_key = await resolve_ai_runtime_config(
        db,
        scenario_id="recommend_copy",
    )
    if not api_key:
        raise LlmError(
            "未配置 API Key：请在 AI 配置页为「推荐话术」场景绑定供应商并保存 API Key"
        )
    return get_llm_provider(
        provider_name,
        base_url=base_url,
        api_key=api_key,
        model=model,
    )


def _parse_optimized_text(raw: str) -> str:
    data = extract_first_json_object(raw)
    text = data.get("optimized_text")
    if not isinstance(text, str) or not text.strip():
        raise LlmError("LLM 未返回有效的 optimized_text。")
    return text.strip()


async def optimize_selected_copy(
    db: AsyncSession,
    *,
    draft: ContentFactoryDraft,
    selected_text: str,
    full_body: str | None = None,
) -> str:
    provider = await _get_llm(db)
    platform_label = _PLATFORM_LABELS.get(draft.platform, draft.platform)
    template = _OPTIMIZE_SELECTION_PROMPT_PATH.read_text(encoding="utf-8")
    context_body = (full_body or draft.body or "").strip() or "(空)"
    user = (
        template.replace("{{platform_label}}", platform_label)
        .replace("{{full_body}}", context_body)
        .replace("{{selected_text}}", selected_text.strip())
    )
    system = "你是文案润色助手。只输出合法 JSON，不要 markdown 代码块或额外说明。"
    raw = await provider.complete(
        system=system,
        user=user,
        temperature=0.4,
        max_tokens=1024,
        json_mode=True,
    )
    return _parse_optimized_text(raw)


async def generate_single_project_copy(
    db: AsyncSession,
    *,
    draft: ContentFactoryDraft,
    project: Project,
    preview_only: bool = False,
    platform: str | None = None,
    from_source: bool = False,
    regenerate: bool = False,
) -> tuple[ContentFactoryCopyJson, ContentFactoryDraft | None]:
    target_platform = platform or draft.platform
    provider = await _get_llm(db)
    platform_label = _PLATFORM_LABELS.get(target_platform, target_platform)
    platform_style_hint = _platform_style_hint(target_platform)
    project_context = _build_project_context(project)

    if from_source:
        source_title, source_body = _read_source_from_body_json(draft.body_json)
        if not source_body:
            raise LlmError("请先在「原文」中填写正文，再进行平台排版。")
        if regenerate:
            template = _load_regenerate_platform_template()
            system = (
                "你是多平台文案改写助手。只输出合法 JSON，"
                "不要 markdown 代码块或额外说明。"
            )
        else:
            template = _load_layout_from_source_template()
            system = (
                "你是多平台文案排版助手。只输出合法 JSON，不要 markdown 代码块或额外说明。"
            )
        user = (
            template.replace("{{platform_label}}", platform_label)
            .replace("{{platform_style_hint}}", platform_style_hint)
            .replace("{{source_title}}", source_title or "(无标题)")
            .replace("{{source_body}}", source_body)
            .replace("{{project_context}}", project_context)
        )
    else:
        template = _load_prompt_template()
        user = (
            template.replace("{{platform_label}}", platform_label)
            .replace("{{platform_style_hint}}", platform_style_hint)
            .replace("{{project_context}}", project_context)
        )
        system = (
            "你是 GitHub 开源项目推荐文案助手。只输出合法 JSON，不要 markdown 代码块或额外说明。"
        )

    raw = await provider.complete(
        system=system,
        user=user,
        temperature=0.5,
        max_tokens=4096,
        json_mode=True,
    )
    copy = _parse_copy_json(raw)

    if preview_only:
        return copy, None

    draft.platform = target_platform
    draft.body = copy.body
    draft.body_json = _merge_generated_into_body_json(
        draft.body_json,
        platform=target_platform,
        copy=copy,
    )
    draft.title = copy.title_options[0] if copy.title_options else draft.title
    draft.status = "generated"
    draft.step = max(draft.step, 3)
    draft.updated_at = draft.updated_at  # trigger onupdate on commit
    await db.commit()
    await db.refresh(draft)
    return copy, draft


def draft_to_read(draft: ContentFactoryDraft, project: Project) -> ContentFactoryDraftRead:
    from app.schemas.content_factory import ContentFactoryProjectBrief

    return ContentFactoryDraftRead(
        id=draft.id,
        project_library_id=draft.project_library_id,
        project_id=draft.project_id,
        kind=draft.kind,
        platform=draft.platform,  # type: ignore[arg-type]
        step=draft.step,
        status=draft.status,  # type: ignore[arg-type]
        title=draft.title,
        body=draft.body,
        body_json=draft.body_json,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
        project=ContentFactoryProjectBrief(
            id=project.id,
            name=project.name,
            full_name=project.full_name,
            description=project.description_translated or project.description,
            stars=project.stars,
            language=project.language,
        ),
    )


async def get_draft_with_project(
    db: AsyncSession,
    *,
    library_id: int,
    draft_id: int,
) -> tuple[ContentFactoryDraft, Project] | None:
    stmt = (
        select(ContentFactoryDraft, Project)
        .join(Project, Project.id == ContentFactoryDraft.project_id)
        .where(
            ContentFactoryDraft.id == draft_id,
            ContentFactoryDraft.project_library_id == library_id,
            Project.project_library_id == library_id,
            Project.deleted_at.is_(None),
        )
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return None
    return row[0], row[1]

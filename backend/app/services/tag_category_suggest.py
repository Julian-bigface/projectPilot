"""标签 AI 分类：建议与批量应用。"""

from __future__ import annotations

import json
from dataclasses import dataclass

from pydantic import BaseModel, ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag, TagCategory
from app.schemas.tag_ai import (
    TagCategoryApplyItem,
    TagCategoryApplyResponse,
    TagCategoryProposal,
    TagCategorySuggestResponse,
)
from app.services.llm import get_llm_provider
from app.services.llm.provider import LlmError, LlmProvider
from app.services.settings_ai import resolve_ai_runtime_config

BATCH_SIZE = 25
MAX_RETRIES = 1


@dataclass(frozen=True)
class _TagRow:
    id: int
    name: str


@dataclass(frozen=True)
class _CategoryRow:
    id: int
    name: str


class _LlmBatchResponse(BaseModel):
    proposals: list[TagCategoryProposal]


def _normalize_category_name(name: str) -> str:
    return " ".join(name.strip().split())


def _coarsen_new_category_name(name: str) -> str:
    """将过细的新分类名归并为粗粒度领域名。"""
    n = _normalize_category_name(name)
    if not n:
        return n
    lower = n.lower()

    ai_markers = (
        "ai",
        "人工智能",
        "机器学习",
        "深度学习",
        "大模型",
        "llm",
        "gpt",
        "agent",
        "智能体",
        "nlp",
        "cv",
        "多模态",
    )
    if lower == "ai" or lower.startswith("ai") or any(m in lower or m in n for m in ai_markers):
        return "AI"

    if any(k in n for k in ("前端", "Frontend", "Web开发", "Web 开发")):
        return "前端"
    if any(k in n for k in ("后端", "Backend", "服务端")):
        return "后端"
    if any(k in n for k in ("运维", "部署", "DevOps", "SRE", "容器", "Kubernetes")):
        return "运维与部署"
    if any(k in n for k in ("设计", "UI", "UX", "Figma", "产品")):
        return "产品与设计"
    if any(k in n for k in ("交易", "投资", "量化", "金融", "证券")):
        return "交易与投资"
    if any(k in n for k in ("数据", "数据库", "Database", "SQL")):
        return "数据"

    return n


def _find_existing_category_by_name(
    categories: list[_CategoryRow],
    name: str,
) -> int | None:
    target = _normalize_category_name(name).lower()
    if not target:
        return None
    for cat in categories:
        if cat.name.lower() == target:
            return cat.id
    return None


def _resolve_coarse_category(
    *,
    category_id: int | None,
    new_name: str | None,
    categories: list[_CategoryRow],
    include_new_categories: bool,
) -> tuple[int | None, str | None]:
    """优先匹配已有粗分类，否则归并 new_category_name。"""
    if category_id is not None:
        return category_id, None

    if not new_name or not include_new_categories:
        return None, None

    coarse = _coarsen_new_category_name(new_name)
    existing_id = _find_existing_category_by_name(categories, coarse)
    if existing_id is not None:
        return existing_id, None
    return None, coarse


def _build_system_prompt(*, include_new_categories: bool) -> str:
    new_cat_rule = (
        "若现有分类均不合适，可设 category_id 为 null 并填写 new_category_name 建议新分类名。"
        if include_new_categories
        else "必须为每个标签从给定 categories 中选择 category_id；不得建议 new_category_name。"
    )
    return f"""你是 GitHub 开源项目领域标签整理助手。用户有一批未分类标签和已有分类列表。
请为每个标签选择最合适的分类。

分类粒度（非常重要）：
- 使用粗粒度、领域级分类，不要拆得过细。同一 broad 领域下的标签必须归入同一分类。
- 示例：「AI基础」「AI编程」「AI工具」「机器学习」「LLM」「大模型」等一律归入「AI」（若已有「AI」分类则选其 category_id，否则 new_category_name 填「AI」，不要新建更细名称）。
- 类似地：多种前端框架标签归入「前端」；Docker/K8s/CI 等归入「运维与部署」；设计/UI 归入「产品与设计」。
- 优先从已有 categories 中选择最宽泛、最上层的匹配项；已有父级分类时禁止新建子类。
- 若必须新建分类，名称应简短（通常 2~6 字），表示领域大类，如：前端、后端、AI、运维、数据、设计；避免「XX工具」「XX基础」「XX编程」等过细拆分。

规则：
1. 只输出 JSON，格式：{{"proposals":[{{"tag_id":number,"tag_name":string,"category_id":number|null,"new_category_name":string|null,"confidence":"high"|"medium"|"low","reason":string|null}}]}}
2. category_id 必须来自用户提供的 categories 列表，或为 null。
3. {new_cat_rule}
4. confidence 表示归类把握：high=非常确定，medium=较合理，low=勉强或歧义大。
5. 每个输入 tag 必须有一条 proposal，tag_id 与输入一致。
6. reason 一律设为 null，勿输出解释文字，以缩短 JSON。"""


def _build_user_prompt(
    categories: list[_CategoryRow],
    tags: list[_TagRow],
) -> str:
    cat_json = json.dumps([{"id": c.id, "name": c.name} for c in categories], ensure_ascii=False)
    tag_json = json.dumps([{"id": t.id, "name": t.name} for t in tags], ensure_ascii=False)
    return f"categories:\n{cat_json}\n\ntags:\n{tag_json}"


def _strip_markdown_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _extract_first_json_object(text: str) -> dict:
    """从 LLM 回复中提取第一个完整 JSON object（避免 greedy 正则吞进多段 JSON）。"""
    text = _strip_markdown_fence(text.strip())
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    if start < 0:
        raise LlmError("LLM 返回无法解析为 JSON。")

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                snippet = text[start : i + 1]
                try:
                    data = json.loads(snippet)
                except json.JSONDecodeError as err:
                    raise LlmError(f"LLM JSON 无效：{err}") from err
                if not isinstance(data, dict):
                    raise LlmError("LLM JSON 根节点须为 object。")
                return data

    raise LlmError("LLM 返回 JSON 不完整（可能被截断）。")


def _parse_llm_json(raw: str) -> _LlmBatchResponse:
    try:
        data = _extract_first_json_object(raw)
    except LlmError:
        raise
    except json.JSONDecodeError as err:
        raise LlmError(f"LLM JSON 无效：{err}") from err
    try:
        return _LlmBatchResponse.model_validate(data)
    except ValidationError as err:
        raise LlmError(f"LLM JSON 结构无效：{err}") from err


def _validate_proposal(
    proposal: TagCategoryProposal,
    *,
    tag_by_id: dict[int, _TagRow],
    valid_category_ids: set[int],
    include_new_categories: bool,
    categories: list[_CategoryRow],
) -> TagCategoryProposal | None:
    tag = tag_by_id.get(proposal.tag_id)
    if tag is None:
        return None

    name = tag.name
    category_id = proposal.category_id
    new_name = proposal.new_category_name
    if new_name is not None:
        new_name = _normalize_category_name(new_name) or None

    if category_id is not None and category_id not in valid_category_ids:
        category_id = None

    category_id, new_name = _resolve_coarse_category(
        category_id=category_id,
        new_name=new_name,
        categories=categories,
        include_new_categories=include_new_categories,
    )

    if category_id is not None:
        new_name = None
    elif not include_new_categories:
        new_name = None

    if category_id is None and not new_name:
        return None

    conf = proposal.confidence if proposal.confidence in ("high", "medium", "low") else "medium"

    return TagCategoryProposal(
        tag_id=proposal.tag_id,
        tag_name=name,
        category_id=category_id,
        new_category_name=new_name,
        confidence=conf,
        reason=proposal.reason,
    )


async def _call_llm_batch(
    provider: LlmProvider,
    *,
    categories: list[_CategoryRow],
    tags: list[_TagRow],
    include_new_categories: bool,
) -> list[TagCategoryProposal]:
    system = _build_system_prompt(include_new_categories=include_new_categories)
    user = _build_user_prompt(categories, tags)
    max_tokens = min(8192, len(tags) * 96 + 256)
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            raw = await provider.complete(
                system=system,
                user=user,
                temperature=0.2,
                max_tokens=max_tokens,
                json_mode=True,
            )
            parsed = _parse_llm_json(raw)
            return parsed.proposals
        except (LlmError, ValidationError, json.JSONDecodeError) as err:
            last_err = err
            if attempt < MAX_RETRIES:
                continue
            raise LlmError(str(last_err)) from last_err
    raise LlmError("LLM 调用失败")


@dataclass(frozen=True)
class _SuggestContext:
    llm: LlmProvider | None
    categories: list[_CategoryRow]
    tags: list[_TagRow]
    include_new_categories: bool
    valid_category_ids: set[int]
    tag_by_id: dict[int, _TagRow]
    total_batches: int


async def _prepare_suggest_context(
    db: AsyncSession,
    *,
    library_id: int,
    tag_ids: list[int] | None,
    include_new_categories: bool,
) -> _SuggestContext:
    provider_name, base_url, model, api_key = await resolve_ai_runtime_config(
        db,
        scenario_id="tag_classification",
    )
    if not api_key:
        raise LlmError(
            "未配置 API Key：请在 AI 配置页为「标签整理」场景绑定供应商并保存 API Key"
        )

    cat_stmt = (
        select(TagCategory.id, TagCategory.name)
        .where(TagCategory.project_library_id == library_id)
        .order_by(TagCategory.sort_order.asc(), TagCategory.name.asc())
    )
    categories = [_CategoryRow(id=r[0], name=r[1]) for r in (await db.execute(cat_stmt)).all()]

    tag_stmt = select(Tag.id, Tag.name).where(
        Tag.project_library_id == library_id,
        Tag.category_id.is_(None),
    )
    if tag_ids:
        tag_stmt = tag_stmt.where(Tag.id.in_(tag_ids))
    tag_stmt = tag_stmt.order_by(Tag.name.asc())
    tags = [_TagRow(id=r[0], name=r[1]) for r in (await db.execute(tag_stmt)).all()]

    if not tags:
        return _SuggestContext(
            llm=None,
            categories=categories,
            tags=[],
            include_new_categories=include_new_categories,
            valid_category_ids=set(),
            tag_by_id={},
            total_batches=0,
        )

    if not categories and not include_new_categories:
        raise ValueError("尚无标签分类：请先创建分类，或开启「允许建议新建分类」")

    llm = get_llm_provider(
        provider_name,
        base_url=base_url,
        api_key=api_key,
        model=model,
    )

    total_batches = (len(tags) + BATCH_SIZE - 1) // BATCH_SIZE
    return _SuggestContext(
        llm=llm,
        categories=categories,
        tags=tags,
        include_new_categories=include_new_categories,
        valid_category_ids={c.id for c in categories},
        tag_by_id={t.id: t for t in tags},
        total_batches=total_batches,
    )


async def _process_suggest_batch(
    ctx: _SuggestContext,
    batch: list[_TagRow],
) -> tuple[list[TagCategoryProposal], list[int]]:
    """处理单批标签，返回 (有效 proposals, 本批 skipped tag ids)。"""
    if ctx.llm is None:
        return [], [t.id for t in batch]
    try:
        raw_proposals = await _call_llm_batch(
            ctx.llm,
            categories=ctx.categories,
            tags=batch,
            include_new_categories=ctx.include_new_categories,
        )
    except LlmError:
        return [], [t.id for t in batch]
    except Exception:
        return [], [t.id for t in batch]

    seen_in_batch: set[int] = set()
    validated_proposals: list[TagCategoryProposal] = []
    for p in raw_proposals:
        validated = _validate_proposal(
            p,
            tag_by_id=ctx.tag_by_id,
            valid_category_ids=ctx.valid_category_ids,
            include_new_categories=ctx.include_new_categories,
            categories=ctx.categories,
        )
        if validated is None:
            continue
        seen_in_batch.add(validated.tag_id)
        validated_proposals.append(validated)

    skipped = [t.id for t in batch if t.id not in seen_in_batch]
    return validated_proposals, skipped


async def iter_suggest_tag_categories_from_context(ctx: _SuggestContext):
    """基于已准备的上下文逐批 yield 流式事件。"""
    from app.schemas.tag_ai import (
        TagCategorySuggestStreamBatch,
        TagCategorySuggestStreamBatchStart,
        TagCategorySuggestStreamDone,
        TagCategorySuggestStreamStart,
    )

    if not ctx.tags:
        yield TagCategorySuggestStreamDone(
            batches=0,
            skipped_tag_ids=[],
            proposal_count=0,
        )
        return

    yield TagCategorySuggestStreamStart(
        total_batches=ctx.total_batches,
        total_tags=len(ctx.tags),
    )

    all_proposals: list[TagCategoryProposal] = []
    all_skipped: set[int] = set()
    batch_index = 0

    for i in range(0, len(ctx.tags), BATCH_SIZE):
        batch = ctx.tags[i : i + BATCH_SIZE]
        batch_index += 1
        yield TagCategorySuggestStreamBatchStart(
            batch_index=batch_index,
            total_batches=ctx.total_batches,
            tag_count=len(batch),
        )
        proposals, skipped = await _process_suggest_batch(ctx, batch)
        all_proposals.extend(proposals)
        all_skipped.update(skipped)
        yield TagCategorySuggestStreamBatch(
            batch_index=batch_index,
            total_batches=ctx.total_batches,
            proposals=proposals,
            skipped_tag_ids=skipped,
        )

    yield TagCategorySuggestStreamDone(
        batches=batch_index,
        skipped_tag_ids=sorted(all_skipped),
        proposal_count=len(all_proposals),
    )


async def iter_suggest_tag_categories(
    db: AsyncSession,
    *,
    library_id: int,
    tag_ids: list[int] | None,
    include_new_categories: bool,
):
    """逐批 yield NDJSON 事件（start / batch / done）。"""
    ctx = await _prepare_suggest_context(
        db,
        library_id=library_id,
        tag_ids=tag_ids,
        include_new_categories=include_new_categories,
    )
    async for event in iter_suggest_tag_categories_from_context(ctx):
        yield event


async def suggest_tag_categories(
    db: AsyncSession,
    *,
    library_id: int,
    tag_ids: list[int] | None,
    include_new_categories: bool,
) -> TagCategorySuggestResponse:
    all_proposals: list[TagCategoryProposal] = []
    skipped: list[int] = []
    batches = 0

    async for event in iter_suggest_tag_categories(
        db,
        library_id=library_id,
        tag_ids=tag_ids,
        include_new_categories=include_new_categories,
    ):
        if event.event == "batch":
            all_proposals.extend(event.proposals)
        elif event.event == "done":
            skipped = event.skipped_tag_ids
            batches = event.batches

    return TagCategorySuggestResponse(
        proposals=all_proposals,
        batches=batches,
        skipped_tag_ids=skipped,
    )


async def _get_or_create_category(
    db: AsyncSession,
    *,
    library_id: int,
    name: str,
) -> tuple[TagCategory, bool]:
    normalized = _normalize_category_name(name)
    if not normalized:
        raise ValueError("分类名不能为空")

    existing = await db.scalar(
        select(TagCategory).where(
            TagCategory.project_library_id == library_id,
            TagCategory.name == normalized,
        )
    )
    if existing is not None:
        return existing, False

    max_so = await db.scalar(
        select(func.coalesce(func.max(TagCategory.sort_order), -1)).where(
            TagCategory.project_library_id == library_id
        )
    )
    next_order = int(max_so if max_so is not None else -1) + 1
    cat = TagCategory(name=normalized, sort_order=next_order, project_library_id=library_id)
    try:
        async with db.begin_nested():
            db.add(cat)
            await db.flush()
        return cat, True
    except IntegrityError:
        existing = await db.scalar(
            select(TagCategory).where(
                TagCategory.project_library_id == library_id,
                TagCategory.name == normalized,
            )
        )
        if existing is None:
            raise
        return existing, False


async def apply_tag_category_suggestions(
    db: AsyncSession,
    *,
    library_id: int,
    items: list[TagCategoryApplyItem],
) -> TagCategoryApplyResponse:
    applied = 0
    categories_created = 0
    skipped = 0
    errors: list[str] = []

    for item in items:
        tag = await db.get(Tag, item.tag_id)
        if tag is None or tag.project_library_id != library_id:
            skipped += 1
            errors.append(f"标签 {item.tag_id} 不存在或不属于当前库")
            continue

        category_id = item.category_id
        if category_id is not None:
            cat = await db.get(TagCategory, category_id)
            if cat is None or cat.project_library_id != library_id:
                skipped += 1
                errors.append(f"标签 {item.tag_id}：分类 {category_id} 无效")
                continue
        elif item.new_category_name:
            try:
                cat, created = await _get_or_create_category(
                    db,
                    library_id=library_id,
                    name=item.new_category_name,
                )
                category_id = cat.id
                if created:
                    categories_created += 1
            except (ValueError, IntegrityError) as err:
                skipped += 1
                errors.append(f"标签 {item.tag_id}：无法创建分类 — {err}")
                continue
        else:
            skipped += 1
            errors.append(f"标签 {item.tag_id}：未指定 category_id 或 new_category_name")
            continue

        tag.category_id = category_id
        applied += 1

    await db.commit()
    return TagCategoryApplyResponse(
        applied=applied,
        categories_created=categories_created,
        skipped=skipped,
        errors=errors,
    )

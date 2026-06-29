"""AI / LLM 相关应用设置（多厂商 + 场景映射）。"""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.models.app_settings import AppSetting
from app.schemas.settings_ai import (
    AI_SCENARIO_IDS,
    AI_SCENARIO_LABELS,
    AiConfigRead,
    AiConfigUpdate,
    AiProviderRead,
    AiProviderWrite,
    AiScenarioBinding,
)
from app.services.llm import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_PRESET_ID,
    DEFAULT_PROVIDER,
    SUPPORTED_PROVIDERS,
)
from app.services.settings_github import token_preview_last_n

AI_PROVIDER_KEY = "ai_provider"
AI_PRESET_KEY = "ai_preset_id"
AI_BASE_URL_KEY = "ai_base_url"
AI_MODEL_KEY = "ai_model"
AI_API_KEY_KEY = "ai_api_key"

AI_PROVIDERS_KEY = "ai_providers_json"
AI_DEFAULT_PROVIDER_ID_KEY = "ai_default_provider_id"
AI_SCENARIOS_KEY = "ai_scenarios_json"

DEFAULT_PROVIDER_ID = "default"

IMAGE_ONLY_PRESET_IDS = frozenset({"rootflowai-image"})


async def _get_setting(db: AsyncSession, key: str) -> str | None:
    row = await db.get(AppSetting, key)
    if row is None or row.value is None:
        return None
    return row.value.strip() or None


async def _set_setting(db: AsyncSession, key: str, value: str) -> None:
    row = await db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=value))
    else:
        row.value = value


async def _delete_setting(db: AsyncSession, key: str) -> None:
    await db.execute(delete(AppSetting).where(AppSetting.key == key))


def effective_ai_api_key(db_value: str | None, env_value: str | None) -> str | None:
    """生效 API Key：数据库非空则用之，否则回退 OPENAI_API_KEY。"""
    if db_value and db_value.strip():
        return db_value.strip()
    if env_value and env_value.strip():
        return env_value.strip()
    return None


def normalize_provider(value: str | None) -> str:
    if value and value.strip() in SUPPORTED_PROVIDERS:
        return value.strip()
    return DEFAULT_PROVIDER


def normalize_base_url(value: str | None) -> str:
    if value and value.strip():
        return value.strip().rstrip("/")
    return DEFAULT_BASE_URL


def normalize_model(value: str | None) -> str:
    if value and value.strip():
        return value.strip()
    return DEFAULT_MODEL


def normalize_preset_id(value: str | None) -> str:
    if value and value.strip():
        return value.strip()
    return DEFAULT_PRESET_ID


def _normalize_models(models: list[str] | None, default_model: str | None = None) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in models or []:
        name = str(raw).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        result.append(name)
    if default_model:
        dm = default_model.strip()
        if dm and dm not in seen:
            result.insert(0, dm)
    return result


def _default_provider_record(*, api_key: str = "") -> dict[str, Any]:
    return {
        "id": DEFAULT_PROVIDER_ID,
        "name": "MiniMax",
        "preset_id": DEFAULT_PRESET_ID,
        "provider": DEFAULT_PROVIDER,
        "base_url": DEFAULT_BASE_URL,
        "models": [DEFAULT_MODEL],
        "default_model": DEFAULT_MODEL,
        "api_key": api_key,
    }


def _default_scenarios(default_provider_id: str, default_model: str) -> dict[str, dict[str, str | None]]:
    binding = {"provider_id": default_provider_id, "model": default_model}
    return {scenario_id: dict(binding) for scenario_id in AI_SCENARIO_IDS}


def _parse_providers_raw(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


def _parse_scenarios_raw(raw: str | None) -> dict[str, dict[str, str | None]]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    result: dict[str, dict[str, str | None]] = {}
    for key, value in data.items():
        if not isinstance(key, str) or not isinstance(value, dict):
            continue
        result[key] = {
            "provider_id": str(value.get("provider_id") or "").strip() or None,
            "model": str(value.get("model") or "").strip() or None,
        }
    return result


def _provider_to_read(
    record: dict[str, Any],
    *,
    is_default: bool,
) -> AiProviderRead:
    db_key = str(record.get("api_key") or "").strip()
    eff = effective_ai_api_key(db_key, None)
    models = _normalize_models(record.get("models"), str(record.get("default_model") or ""))
    default_model = str(record.get("default_model") or "").strip() or (models[0] if models else "")
    return AiProviderRead(
        id=str(record.get("id") or ""),
        name=str(record.get("name") or "未命名供应商").strip() or "未命名供应商",
        preset_id=normalize_preset_id(str(record.get("preset_id") or "")),
        provider=normalize_provider(str(record.get("provider") or "")),
        base_url=normalize_base_url(str(record.get("base_url") or "")),
        models=models,
        default_model=default_model,
        has_api_key=eff is not None,
        api_key=db_key if db_key else None,
        api_key_preview=token_preview_last_n(db_key) if db_key else None,
        api_key_length=len(db_key) if db_key else None,
        is_default=is_default,
    )


async def get_ai_api_key_row(db: AsyncSession) -> str | None:
    return await _get_setting(db, AI_API_KEY_KEY)


async def set_ai_api_key_row(db: AsyncSession, api_key: str | None) -> None:
    if api_key is None or not api_key.strip():
        await _delete_setting(db, AI_API_KEY_KEY)
        return
    await _set_setting(db, AI_API_KEY_KEY, api_key.strip())


async def _load_provider_records(db: AsyncSession) -> list[dict[str, Any]]:
    raw = await _get_setting(db, AI_PROVIDERS_KEY)
    return _parse_providers_raw(raw)


async def _save_provider_records(db: AsyncSession, records: list[dict[str, Any]]) -> None:
    await _set_setting(db, AI_PROVIDERS_KEY, json.dumps(records, ensure_ascii=False))


async def _load_scenario_records(db: AsyncSession) -> dict[str, dict[str, str | None]]:
    raw = await _get_setting(db, AI_SCENARIOS_KEY)
    return _parse_scenarios_raw(raw)


async def _save_scenario_records(
    db: AsyncSession,
    records: dict[str, dict[str, str | None]],
) -> None:
    await _set_setting(db, AI_SCENARIOS_KEY, json.dumps(records, ensure_ascii=False))


async def _sync_legacy_kv_from_default(
    db: AsyncSession,
    provider: dict[str, Any],
) -> None:
    """保持旧 KV 与默认供应商同步，供遗留 API 读取。"""
    await _set_setting(db, AI_PROVIDER_KEY, normalize_provider(str(provider.get("provider") or "")))
    await _set_setting(db, AI_PRESET_KEY, normalize_preset_id(str(provider.get("preset_id") or "")))
    await _set_setting(db, AI_BASE_URL_KEY, normalize_base_url(str(provider.get("base_url") or "")))
    default_model = str(provider.get("default_model") or "").strip() or DEFAULT_MODEL
    await _set_setting(db, AI_MODEL_KEY, normalize_model(default_model))
    api_key = str(provider.get("api_key") or "").strip()
    if api_key:
        await set_ai_api_key_row(db, api_key)
    else:
        existing = await get_ai_api_key_row(db)
        if existing is None:
            await _delete_setting(db, AI_API_KEY_KEY)


async def ensure_ai_config_migrated(db: AsyncSession) -> None:
    """从旧单供应商 KV 迁移到多厂商结构（仅首次）。"""
    if await _get_setting(db, AI_PROVIDERS_KEY):
        return

    legacy_key = await get_ai_api_key_row(db)
    legacy_provider = normalize_provider(await _get_setting(db, AI_PROVIDER_KEY))
    legacy_preset = normalize_preset_id(await _get_setting(db, AI_PRESET_KEY))
    legacy_base = normalize_base_url(await _get_setting(db, AI_BASE_URL_KEY))
    legacy_model = normalize_model(await _get_setting(db, AI_MODEL_KEY))

    name = "MiniMax"
    if legacy_preset.startswith("openai"):
        name = "OpenAI"
    elif legacy_preset.startswith("deepseek"):
        name = "DeepSeek"
    elif legacy_preset == "custom":
        name = "Custom"

    provider = {
        "id": DEFAULT_PROVIDER_ID,
        "name": name,
        "preset_id": legacy_preset,
        "provider": legacy_provider,
        "base_url": legacy_base,
        "models": _normalize_models([legacy_model], legacy_model),
        "default_model": legacy_model,
        "api_key": legacy_key or "",
    }
    await _save_provider_records(db, [provider])
    await _set_setting(db, AI_DEFAULT_PROVIDER_ID_KEY, DEFAULT_PROVIDER_ID)
    await _save_scenario_records(db, _default_scenarios(DEFAULT_PROVIDER_ID, legacy_model))
    await _sync_legacy_kv_from_default(db, provider)


def _find_provider(records: list[dict[str, Any]], provider_id: str | None) -> dict[str, Any] | None:
    if not provider_id:
        return None
    for record in records:
        if str(record.get("id") or "") == provider_id:
            return record
    return None


def _resolve_default_provider_id(
    records: list[dict[str, Any]],
    stored_default_id: str | None,
) -> str | None:
    if stored_default_id and _find_provider(records, stored_default_id):
        return stored_default_id
    if records:
        return str(records[0].get("id") or "")
    return None


def _merge_scenarios(
    stored: dict[str, dict[str, str | None]],
    default_provider_id: str | None,
    default_model: str,
) -> dict[str, AiScenarioBinding]:
    result: dict[str, AiScenarioBinding] = {}
    for scenario_id in AI_SCENARIO_IDS:
        raw = stored.get(scenario_id) or {}
        provider_id = raw.get("provider_id") or default_provider_id
        model = raw.get("model") or default_model
        result[scenario_id] = AiScenarioBinding(provider_id=provider_id, model=model)
    return result


async def load_ai_config(db: AsyncSession) -> AiConfigRead:
    await ensure_ai_config_migrated(db)
    records = await _load_provider_records(db)
    default_id = _resolve_default_provider_id(
        records,
        await _get_setting(db, AI_DEFAULT_PROVIDER_ID_KEY),
    )
    default_record = _find_provider(records, default_id)
    default_model = (
        str(default_record.get("default_model") or "").strip()
        if default_record
        else DEFAULT_MODEL
    ) or DEFAULT_MODEL
    scenarios_raw = await _load_scenario_records(db)
    scenarios = _merge_scenarios(scenarios_raw, default_id, default_model)
    providers = [
        _provider_to_read(record, is_default=str(record.get("id") or "") == default_id)
        for record in records
    ]
    return AiConfigRead(
        providers=providers,
        default_provider_id=default_id,
        scenarios=scenarios,
        scenario_labels=dict(AI_SCENARIO_LABELS),
        supported_providers=list(SUPPORTED_PROVIDERS),
    )


def _sanitize_provider_write(
    item: AiProviderWrite,
    existing: dict[str, Any] | None,
) -> dict[str, Any]:
    provider_id = item.id or (str(existing.get("id")) if existing else uuid.uuid4().hex[:12])
    models = _normalize_models(item.models, item.default_model)
    default_model = item.default_model.strip() or (models[0] if models else "")
    if default_model and default_model not in models:
        models.insert(0, default_model)
    api_key = str(existing.get("api_key") or "") if existing else ""
    if item.api_key is not None:
        api_key = item.api_key.strip()
    return {
        "id": provider_id,
        "name": item.name.strip() or "未命名供应商",
        "preset_id": normalize_preset_id(item.preset_id),
        "provider": normalize_provider(item.provider),
        "base_url": normalize_base_url(item.base_url),
        "models": models,
        "default_model": default_model,
        "api_key": api_key,
    }


async def update_ai_config(db: AsyncSession, body: AiConfigUpdate) -> AiConfigRead:
    await ensure_ai_config_migrated(db)
    existing_records = await _load_provider_records(db)
    existing_by_id = {str(r.get("id") or ""): r for r in existing_records}

    next_records: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for item in body.providers:
        existing = existing_by_id.get(item.id or "")
        record = _sanitize_provider_write(item, existing)
        if record["id"] in seen_ids:
            raise ValueError(f"重复的供应商 id：{record['id']}")
        seen_ids.add(record["id"])
        next_records.append(record)

    if not next_records:
        raise ValueError("至少保留一个 AI 供应商")

    default_id = body.default_provider_id.strip()
    if not _find_provider(next_records, default_id):
        default_id = str(next_records[0]["id"])

    scenarios: dict[str, dict[str, str | None]] = {}
    for scenario_id in AI_SCENARIO_IDS:
        binding = body.scenarios.get(scenario_id) or AiScenarioBinding()
        provider_id = binding.provider_id
        if provider_id and not _find_provider(next_records, provider_id):
            provider_id = default_id
        model = binding.model
        if provider_id:
            provider = _find_provider(next_records, provider_id)
            if provider and model:
                models = _normalize_models(provider.get("models"), provider.get("default_model"))
                if model not in models:
                    models.append(model)
                    provider["models"] = models
        scenarios[scenario_id] = {
            "provider_id": provider_id or default_id,
            "model": model,
        }

    await _save_provider_records(db, next_records)
    await _set_setting(db, AI_DEFAULT_PROVIDER_ID_KEY, default_id)
    await _save_scenario_records(db, scenarios)

    default_record = _find_provider(next_records, default_id)
    if default_record:
        await _sync_legacy_kv_from_default(db, default_record)

    return await load_ai_config(db)


async def resolve_ai_settings_for_read(
    db: AsyncSession,
) -> tuple[str, str, str, str, bool, str | None, int | None]:
    config = await load_ai_config(db)
    default = next((p for p in config.providers if p.is_default), None)
    if default is None and config.providers:
        default = config.providers[0]
    if default is None:
        return (
            DEFAULT_PROVIDER,
            DEFAULT_PRESET_ID,
            DEFAULT_BASE_URL,
            DEFAULT_MODEL,
            False,
            None,
            None,
        )
    return (
        default.provider,
        default.preset_id,
        default.base_url,
        default.default_model or DEFAULT_MODEL,
        default.has_api_key,
        default.api_key_preview,
        default.api_key_length,
    )


def _runtime_from_provider_record(
    record: dict[str, Any],
    *,
    model_override: str | None = None,
) -> tuple[str, str, str, str]:
    provider = normalize_provider(str(record.get("provider") or ""))
    base_url = normalize_base_url(str(record.get("base_url") or ""))
    default_model = str(record.get("default_model") or "").strip() or DEFAULT_MODEL
    model = normalize_model(model_override or default_model)
    db_key = str(record.get("api_key") or "").strip()
    key = effective_ai_api_key(db_key, app_settings.openai_api_key) or ""
    return provider, base_url, model, key


async def resolve_ai_runtime_config(
    db: AsyncSession,
    *,
    scenario_id: str | None = None,
    provider_id: str | None = None,
) -> tuple[str, str, str, str]:
    """返回 (provider, base_url, model, api_key)；无 Key 时 api_key 为空字符串。"""
    await ensure_ai_config_migrated(db)
    records = await _load_provider_records(db)
    default_id = _resolve_default_provider_id(
        records,
        await _get_setting(db, AI_DEFAULT_PROVIDER_ID_KEY),
    )

    model_override: str | None = None
    target_id = provider_id

    if scenario_id and not target_id:
        scenarios = await _load_scenario_records(db)
        binding = scenarios.get(scenario_id) or {}
        target_id = binding.get("provider_id") or default_id
        model_override = binding.get("model")

    if not target_id:
        target_id = default_id

    record = _find_provider(records, target_id) or (records[0] if records else None)
    if record is None:
        return DEFAULT_PROVIDER, DEFAULT_BASE_URL, DEFAULT_MODEL, ""

    return _runtime_from_provider_record(record, model_override=model_override)


async def resolve_provider_preset_id(
    db: AsyncSession,
    *,
    provider_id: str,
) -> str:
    """返回指定供应商的 preset_id。"""
    await ensure_ai_config_migrated(db)
    records = await _load_provider_records(db)
    record = _find_provider(records, provider_id)
    if record is None:
        return DEFAULT_PRESET_ID
    return normalize_preset_id(str(record.get("preset_id") or ""))


def is_image_only_preset(preset_id: str) -> bool:
    return normalize_preset_id(preset_id) in IMAGE_ONLY_PRESET_IDS


async def resolve_ai_scenario_preset_id(
    db: AsyncSession,
    *,
    scenario_id: str,
) -> str:
    """返回场景绑定供应商的 preset_id（用于 Vision 模型门禁等）。"""
    await ensure_ai_config_migrated(db)
    records = await _load_provider_records(db)
    default_id = _resolve_default_provider_id(
        records,
        await _get_setting(db, AI_DEFAULT_PROVIDER_ID_KEY),
    )
    scenarios = await _load_scenario_records(db)
    binding = scenarios.get(scenario_id) or {}
    target_id = binding.get("provider_id") or default_id
    record = _find_provider(records, target_id) or (records[0] if records else None)
    if record is None:
        return DEFAULT_PRESET_ID
    return normalize_preset_id(str(record.get("preset_id") or ""))


async def set_default_provider_api_key(db: AsyncSession, api_key: str | None) -> None:
    """更新默认供应商 API Key，并同步遗留 KV。"""
    await ensure_ai_config_migrated(db)
    records = await _load_provider_records(db)
    default_id = _resolve_default_provider_id(
        records,
        await _get_setting(db, AI_DEFAULT_PROVIDER_ID_KEY),
    )
    record = _find_provider(records, default_id)
    if record is None:
        record = _default_provider_record()
        records = [record]
        default_id = record["id"]
    record["api_key"] = api_key.strip() if api_key and api_key.strip() else ""
    await _save_provider_records(db, records)
    await _set_setting(db, AI_DEFAULT_PROVIDER_ID_KEY, default_id)
    await _sync_legacy_kv_from_default(db, record)


async def update_ai_settings(
    db: AsyncSession,
    *,
    provider: str | None = None,
    preset_id: str | None = None,
    base_url: str | None = None,
    model: str | None = None,
) -> None:
    """遗留单供应商更新：写入默认供应商并同步多厂商结构。"""
    await ensure_ai_config_migrated(db)
    records = await _load_provider_records(db)
    default_id = _resolve_default_provider_id(
        records,
        await _get_setting(db, AI_DEFAULT_PROVIDER_ID_KEY),
    )
    record = _find_provider(records, default_id)
    if record is None:
        record = _default_provider_record()
        records = [record]
        default_id = record["id"]

    if provider is not None:
        record["provider"] = normalize_provider(provider)
    if preset_id is not None:
        record["preset_id"] = normalize_preset_id(preset_id)
    if base_url is not None:
        record["base_url"] = normalize_base_url(base_url)
    if model is not None:
        normalized = normalize_model(model)
        record["default_model"] = normalized
        record["models"] = _normalize_models(record.get("models"), normalized)

    await _save_provider_records(db, records)
    await _set_setting(db, AI_DEFAULT_PROVIDER_ID_KEY, default_id)
    await _sync_legacy_kv_from_default(db, record)

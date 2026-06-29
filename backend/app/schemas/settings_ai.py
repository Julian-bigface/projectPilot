from __future__ import annotations

from pydantic import BaseModel, Field

from app.services.llm import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_PRESET_ID,
    DEFAULT_PROVIDER,
    SUPPORTED_PROVIDERS,
)

AI_SCENARIO_IDS: tuple[str, ...] = (
    "tag_classification",
    "recommend_copy",
    "recommend_image",
    "recommend_cover_style",
)

AI_SCENARIO_LABELS: dict[str, str] = {
    "tag_classification": "标签整理",
    "recommend_copy": "内容工厂推荐话术",
    "recommend_image": "推荐配图",
    "recommend_cover_style": "封面风格生成",
}


class AiScenarioBinding(BaseModel):
    provider_id: str | None = Field(default=None, description="绑定的供应商 id")
    model: str | None = Field(default=None, description="该场景使用的模型")


class AiProviderRead(BaseModel):
    id: str
    name: str
    preset_id: str
    provider: str
    base_url: str
    models: list[str] = Field(default_factory=list)
    default_model: str = Field(default="")
    has_api_key: bool = False
    api_key: str | None = Field(
        default=None,
        description="已保存的 API Key 全文（本地应用设置页回显；未配置时为 null）",
    )
    api_key_preview: str | None = None
    api_key_length: int | None = None
    is_default: bool = False


class AiProviderWrite(BaseModel):
    id: str | None = Field(default=None, description="省略则新建")
    name: str
    preset_id: str
    provider: str = Field(default=DEFAULT_PROVIDER)
    base_url: str
    models: list[str] = Field(default_factory=list)
    default_model: str = Field(default="")
    api_key: str | None = Field(
        default=None,
        description="写入数据库；省略表示不修改；传 null 或空字符串表示清除",
    )


class AiConfigRead(BaseModel):
    providers: list[AiProviderRead] = Field(default_factory=list)
    default_provider_id: str | None = None
    scenarios: dict[str, AiScenarioBinding] = Field(default_factory=dict)
    scenario_labels: dict[str, str] = Field(
        default_factory=lambda: dict(AI_SCENARIO_LABELS),
    )
    supported_providers: list[str] = Field(
        default_factory=lambda: list(SUPPORTED_PROVIDERS),
    )


class AiConfigUpdate(BaseModel):
    providers: list[AiProviderWrite]
    default_provider_id: str
    scenarios: dict[str, AiScenarioBinding] = Field(default_factory=dict)


class AiSettingsRead(BaseModel):
    provider: str = Field(..., description="LLM Provider")
    preset_id: str = Field(..., description="平台预设 id（如 minimax-cn）")
    base_url: str = Field(..., description="OpenAI 兼容 API Base URL")
    model: str = Field(..., description="模型名称")
    has_api_key: bool = Field(..., description="是否存在可用 API Key（数据库或环境变量）")
    api_key_preview: str | None = Field(
        default=None,
        description="仅当 Key 保存在数据库时返回末 4 位",
    )
    api_key_length: int | None = Field(
        default=None,
        description="仅当 Key 保存在数据库时返回字符长度",
    )
    supported_providers: list[str] = Field(
        default_factory=lambda: list(SUPPORTED_PROVIDERS),
        description="可选 Provider 列表",
    )
    default_provider: str = Field(default=DEFAULT_PROVIDER)
    default_preset_id: str = Field(default=DEFAULT_PRESET_ID)
    default_base_url: str = Field(default=DEFAULT_BASE_URL)
    default_model: str = Field(default=DEFAULT_MODEL)


class AiSettingsUpdate(BaseModel):
    provider: str | None = Field(default=None, description="LLM Provider")
    preset_id: str | None = Field(default=None, description="平台预设 id")
    base_url: str | None = Field(default=None, description="Base URL")
    model: str | None = Field(default=None, description="模型名称")
    api_key: str | None = Field(
        default=None,
        description="写入数据库；省略表示不修改；传 null 或空字符串表示清除",
    )


class AiTestResponse(BaseModel):
    ok: bool
    message: str | None = None
    sample: str | None = None

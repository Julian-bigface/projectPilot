from __future__ import annotations



from datetime import datetime

from typing import Literal



from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.services.cover_style_design_analysis import CoverStyleDesignAnalysis



ContentFactoryPlatform = Literal["xiaohongshu", "wechat", "twitter", "linkedin"]

ContentFactoryStatus = Literal["draft", "generated"]

ContentFactoryCoverTemplate = Literal[

    "native-readme",

    "minimal-tech",

    "black-gold",

    "code-style",

    "gradient",

    "geek",

]

CoverStyleSource = Literal["builtin", "manual", "ai_generated"]

FontTokenKind = Literal["sans", "serif", "mono", "display"]

CoverSource = Literal["readme_capture", "ai_generated"]





class FontTokensRead(BaseModel):

    heading: FontTokenKind = "sans"

    body: FontTokenKind = "sans"

    accent: FontTokenKind = "mono"





class ColorTokensRead(BaseModel):

    background: str = "#0a0a0a"

    accent: str = "#39ff14"

    text_safe: str = "#ffffff"





class CoverStyleRead(BaseModel):

    id: str

    label: str

    source: CoverStyleSource = "builtin"

    prompt_prefix: str = ""

    prompt_template: str = ""

    negative_prompt: str = ""

    color_tokens: ColorTokensRead = Field(default_factory=ColorTokensRead)

    font_tokens: FontTokensRead = Field(default_factory=FontTokensRead)

    style_report: str | None = None

    design_analysis: CoverStyleDesignAnalysis | None = None

    example_image_url: str | None = None

    reference_image_url: str | None = None

    fork_from_style_id: str | None = None

    hidden: bool = False

    is_deletable: bool = False

    created_at: datetime | None = None





class CoverStyleListResponse(BaseModel):

    items: list[CoverStyleRead] = Field(default_factory=list)





class CoverStyleWrite(BaseModel):

    style_id: str | None = Field(default=None, description="省略则自动生成")

    label: str = Field(min_length=1, max_length=128)

    prompt_prefix: str = Field(min_length=1)

    prompt_template: str = Field(min_length=1)

    negative_prompt: str = ""

    color_tokens: ColorTokensRead = Field(default_factory=ColorTokensRead)

    font_tokens: FontTokensRead = Field(default_factory=FontTokensRead)

    style_report: str | None = None

    fork_from_style_id: str | None = None





class CoverStylePatch(BaseModel):

    label: str | None = Field(default=None, max_length=128)

    prompt_prefix: str | None = None

    prompt_template: str | None = None

    negative_prompt: str | None = None

    color_tokens: ColorTokensRead | None = None

    font_tokens: FontTokensRead | None = None

    style_report: str | None = None

    design_analysis: CoverStyleDesignAnalysis | None = None

    hidden: bool | None = None





class CoverStyleGenerateRequest(BaseModel):

    generation_brief: str | None = Field(default=None, max_length=4000)

    reference_id: str | None = None

    fork_from_style_id: str | None = None

    generate_example: bool = True

    auto_save: bool = True

    @model_validator(mode="after")
    def validate_brief_or_reference(self) -> CoverStyleGenerateRequest:
        brief = (self.generation_brief or "").strip()
        ref_id = (self.reference_id or "").strip()
        if not brief and not ref_id:
            raise ValueError("generation_brief 与 reference_id 至少填写一项")
        return self




class CoverStyleReferenceUploadResponse(BaseModel):

    reference_id: str

    preview_url: str




class CoverStyleSaveParsedRequest(BaseModel):

    name: str = Field(min_length=1, max_length=64)

    prompt_prefix: str = Field(min_length=1)

    prompt_template: str = Field(min_length=1)

    negative_prompt: str = ""

    color_tokens: ColorTokensRead = Field(default_factory=ColorTokensRead)

    font_tokens: FontTokensRead = Field(default_factory=FontTokensRead)

    style_report: str | None = None

    design_analysis: CoverStyleDesignAnalysis | None = None

    reference_id: str | None = None

    fork_from_style_id: str | None = None

    generate_example: bool = True


class CoverStyleRefinePromptTemplateRequest(BaseModel):
    prompt_template: str = Field(min_length=1)
    instruction: str = Field(min_length=1, max_length=2000)
    prompt_prefix: str | None = None


class CoverStyleRefinePromptTemplateResponse(BaseModel):
    prompt_template: str


class CoverStyleRefineRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=2000)
    label: str | None = None
    design_analysis: CoverStyleDesignAnalysis | None = None
    prompt_prefix: str = Field(min_length=1)
    prompt_template: str = Field(min_length=1)
    negative_prompt: str = ""
    color_tokens: ColorTokensRead = Field(default_factory=ColorTokensRead)
    font_tokens: FontTokensRead = Field(default_factory=FontTokensRead)
    style_report: str | None = None


class CoverStyleRefineResponse(BaseModel):
    design_analysis: CoverStyleDesignAnalysis = Field(default_factory=CoverStyleDesignAnalysis)
    prompt_prefix: str
    prompt_template: str
    negative_prompt: str = ""
    color_tokens: ColorTokensRead = Field(default_factory=ColorTokensRead)
    font_tokens: FontTokensRead = Field(default_factory=FontTokensRead)
    style_report: str = ""


class CoverStylePreviewRequest(BaseModel):

    size_preset_id: str = Field(default="xiaohongshu-34")

    force: bool = False





class CoverStylePreviewResponse(BaseModel):

    example_image_url: str

    style_id: str





class CoverStyleForkRequest(BaseModel):

    label: str | None = Field(default=None, max_length=128)

    hidden_source: bool = False





class CoverPromptRecord(BaseModel):

    image_prompt: str = ""

    negative_prompt: str = ""

    prompt_hash: str = ""

    style_id: str = ""





class ContentFactoryProjectBrief(BaseModel):

    id: int

    name: str

    full_name: str

    description: str | None = None

    stars: int = 0

    language: str | None = None





class ContentFactoryPlatformVariant(BaseModel):

    title: str | None = None

    body: str | None = None

    title_options: list[str] = Field(default_factory=list)

    highlight_tags: list[str] = Field(default_factory=list)





class ContentFactoryCopyJson(BaseModel):

    title_options: list[str] = Field(default_factory=list)

    body: str = ""

    hashtags: list[str] = Field(default_factory=list)

    highlight_tags: list[str] = Field(default_factory=list)

    hook: str | None = None

    cover_texts: list[str] = Field(default_factory=list)

    cta: str | None = None

    image_template: str | None = None

    source_title: str | None = None

    source_body: str | None = None

    platform_variants: dict[str, ContentFactoryPlatformVariant] | None = None

    cover_image_path: str | None = None

    cover_readme_sha: str | None = None

    cover_generated_at: str | None = None

    cover_source: CoverSource | None = None

    cover_style_id: str | None = None

    cover_style_source: CoverStyleSource | None = None

    cover_prompt_record: CoverPromptRecord | dict | None = None

    cover_size_preset_id: str | None = None

    cover_prompt_hash: str | None = None

    cover_variants: dict[str, dict] | None = None





class ContentFactoryDraftCreate(BaseModel):

    project_id: int

    platform: ContentFactoryPlatform = "xiaohongshu"





class ContentFactoryDraftUpdate(BaseModel):

    platform: ContentFactoryPlatform | None = None

    step: int | None = Field(None, ge=1, le=4)

    title: str | None = None

    body: str | None = None

    body_json: ContentFactoryCopyJson | dict | None = None

    status: ContentFactoryStatus | None = None





class ContentFactoryDraftRead(BaseModel):

    model_config = ConfigDict(from_attributes=True)



    id: int

    project_library_id: int

    project_id: int

    kind: str

    platform: ContentFactoryPlatform

    step: int

    status: ContentFactoryStatus

    title: str | None

    body: str | None

    body_json: dict | None

    created_at: datetime

    updated_at: datetime

    project: ContentFactoryProjectBrief





class GenerateCopyRequest(BaseModel):

    preview_only: bool = False

    regenerate: bool = False

    platform: ContentFactoryPlatform | None = None

    from_source: bool = False





class GenerateCopyResponse(BaseModel):

    draft: ContentFactoryDraftRead | None = None

    generated_copy: ContentFactoryCopyJson

    preview_only: bool = False





class OptimizeSelectionRequest(BaseModel):

    selected_text: str = Field(min_length=1, max_length=2000)

    full_body: str | None = Field(default=None, max_length=10000)





class OptimizeSelectionResponse(BaseModel):

    optimized_text: str





class GenerateAiCoverRequest(BaseModel):

    style_id: str = Field(..., min_length=1)

    size_preset_id: str = Field(default="xiaohongshu-34")

    force: bool = False





class UploadCoverResponse(BaseModel):

    cover_url: str

    draft: ContentFactoryDraftRead

    cached: bool





class RevealCoverResponse(BaseModel):

    absolute_path: str

    directory: str


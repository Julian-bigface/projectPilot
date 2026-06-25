export const CONTENT_FACTORY_SECTIONS = [
  { id: "project-promotion", label: "项目推广", enabled: true },
  { id: "series", label: "系列推荐", enabled: false },
  { id: "weekly", label: "周榜导读", enabled: false },
] as const

export type ContentFactorySectionId = (typeof CONTENT_FACTORY_SECTIONS)[number]["id"]

export const RECOMMEND_PLATFORMS = [
  { id: "xiaohongshu", label: "小红书" },
  { id: "wechat", label: "公众号" },
  { id: "twitter", label: "Twitter / X" },
  { id: "linkedin", label: "LinkedIn" },
] as const

export type RecommendPlatform = (typeof RECOMMEND_PLATFORMS)[number]["id"]

export type ContentFactoryView = "source" | RecommendPlatform

export type PlatformVariant = {
  title?: string | null
  body?: string | null
  title_options?: string[]
  highlight_tags?: string[]
}

export const PROMOTION_STEPS = [
  { id: 1, label: "选择项目" },
  { id: 2, label: "项目分析" },
  { id: 3, label: "编辑优化" },
  { id: 4, label: "导出发布" },
] as const

export type CoverStyleSource = "builtin" | "manual" | "ai_generated"

export interface CoverStyleDesignAnalysis {
  design_category: string
  design_system: string
  typography_strategy: {
    title_ratio: string
    weight: string
    hierarchy_levels: string
  }
  layout_system: {
    structure: string
    alignment: string
  }
  color_strategy: {
    main_color: string
    accent_color: string
    background_note: string
  }
  information_density: string
  whitespace_usage: string
  visual_components: string[]
  overall_mood: string
  unique_memory_point: string
}

export interface ContentFactoryCoverStyle {
  id: string
  label: string
  source: CoverStyleSource
  prompt_prefix: string
  prompt_template: string
  negative_prompt: string
  color_tokens: { background: string; accent: string; text_safe: string }
  font_tokens: { heading: string; body: string; accent: string }
  style_report?: string | null
  design_analysis?: CoverStyleDesignAnalysis | null
  example_image_url?: string | null
  reference_image_url?: string | null
  fork_from_style_id?: string | null
  hidden?: boolean
  is_deletable?: boolean
  created_at?: string | null
}

export interface CoverStyleOption {
  id: string
  label: string
  source?: CoverStyleSource
  example_image_url?: string | null
}

export type CoverStyleGenerateStreamEvent =
  | { event: "start" }
  | { event: "delta"; text: string }
  | {
      event: "done"
      payload: {
        name: string
        prompt_prefix: string
        prompt_template: string
        negative_prompt: string
        color_tokens: ContentFactoryCoverStyle["color_tokens"]
        font_tokens: ContentFactoryCoverStyle["font_tokens"]
        style_report: string
        design_analysis?: CoverStyleDesignAnalysis | null
      }
    }
  | { event: "error"; detail: string }

export const NATIVE_README_TEMPLATE: CoverStyleOption = {
  id: "native-readme",
  label: "README 首屏",
}

export interface ContentFactoryProjectBrief {
  id: number
  name: string
  full_name: string
  description: string | null
  stars: number
  language: string | null
}

export interface CoverVariantRecord {
  cover_image_path: string
  cover_source?: "readme_capture" | "ai_generated"
  cover_style_id?: string
  cover_size_preset_id?: string
  cover_prompt_hash?: string | null
  cover_readme_sha?: string | null
  cover_generated_at?: string | null
}

export interface ContentFactoryCopyJson {
  title_options?: string[]
  body?: string
  hashtags?: string[]
  highlight_tags?: string[]
  hook?: string
  cover_texts?: string[]
  cta?: string
  image_template?: string | null
  source_title?: string | null
  source_body?: string | null
  platform_variants?: Partial<Record<RecommendPlatform, PlatformVariant>>
  cover_image_path?: string | null
  cover_readme_sha?: string | null
  cover_generated_at?: string | null
  cover_source?: "readme_capture" | "ai_generated" | null
  cover_style_id?: string | null
  cover_style_source?: "builtin" | "manual" | "ai_generated" | null
  cover_size_preset_id?: string | null
  cover_prompt_hash?: string | null
  /** 风格 + 画幅 → 封面记录（切换模板时各自保留） */
  cover_variants?: Record<string, CoverVariantRecord> | null
}

export interface UploadCoverResponse {
  cover_url: string
  draft: ContentFactoryDraft
  cached: boolean
}

export interface ContentFactoryDraft {
  id: number
  project_library_id: number
  project_id: number
  kind: string
  platform: RecommendPlatform
  step: number
  status: "draft" | "generated"
  title: string | null
  body: string | null
  body_json: ContentFactoryCopyJson | null
  created_at: string
  updated_at: string
  project: ContentFactoryProjectBrief
}

export interface GenerateCopyResponse {
  draft: ContentFactoryDraft | null
  generated_copy: ContentFactoryCopyJson
  preview_only: boolean
}

export interface OptimizeSelectionResponse {
  optimized_text: string
}

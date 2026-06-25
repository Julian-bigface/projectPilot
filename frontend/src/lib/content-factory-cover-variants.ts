import type { ContentFactoryCopyJson, CoverVariantRecord } from "@/types/content-factory"

const DEFAULT_SIZE_PRESET_ID = "xiaohongshu-34"

export type { CoverVariantRecord }

export function coverVariantKey(styleId: string, sizePresetId: string): string {
  const style = styleId.trim() || "native-readme"
  const size = sizePresetId.trim() || DEFAULT_SIZE_PRESET_ID
  return `${style}::${size}`
}

export function getCoverVariants(
  copy: ContentFactoryCopyJson | null | undefined
): Record<string, CoverVariantRecord> {
  const raw = copy?.cover_variants
  if (!raw || typeof raw !== "object") {
    return {}
  }
  const out: Record<string, CoverVariantRecord> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value?.cover_image_path) {
      out[key] = value as CoverVariantRecord
    }
  }
  return out
}

/** 读取某风格+画幅的封面；兼容旧草稿单 cover_image_path。 */
export function getCoverVariant(
  copy: ContentFactoryCopyJson | null | undefined,
  styleId: string,
  sizePresetId: string
): CoverVariantRecord | null {
  const key = coverVariantKey(styleId, sizePresetId)
  const fromMap = getCoverVariants(copy)[key]
  if (fromMap) {
    return fromMap
  }
  if (!copy?.cover_image_path) {
    return null
  }
  const storedStyle = copy.cover_style_id ?? copy.image_template
  const storedSize = copy.cover_size_preset_id ?? DEFAULT_SIZE_PRESET_ID
  if (styleId === "native-readme") {
    if (copy.cover_source === "ai_generated") {
      return null
    }
    if (storedStyle && storedStyle !== "native-readme" && copy.cover_source !== "readme_capture") {
      return null
    }
  } else if (copy.cover_source !== "ai_generated") {
    return null
  } else if (storedStyle && storedStyle !== styleId) {
    return null
  }
  if (storedSize !== sizePresetId) {
    return null
  }
  return {
    cover_image_path: copy.cover_image_path,
    cover_source: copy.cover_source ?? undefined,
    cover_style_id: storedStyle ?? styleId,
    cover_size_preset_id: storedSize,
    cover_prompt_hash: copy.cover_prompt_hash,
    cover_readme_sha: copy.cover_readme_sha,
    cover_generated_at: copy.cover_generated_at,
  }
}

export function hasCoverVariant(
  copy: ContentFactoryCopyJson | null | undefined,
  styleId: string,
  sizePresetId: string
): boolean {
  return Boolean(getCoverVariant(copy, styleId, sizePresetId)?.cover_image_path)
}

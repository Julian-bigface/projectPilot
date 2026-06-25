import {
  RECOMMEND_PLATFORMS,
  type ContentFactoryCopyJson,
  type ContentFactoryView,
  type PlatformVariant,
  type RecommendPlatform,
} from "@/types/content-factory"

export type ViewContent = {
  title: string
  body: string
  titleOptions: string[]
  highlightTags: string[]
}

export function isPlatformView(view: ContentFactoryView): view is RecommendPlatform {
  return view !== "source"
}

export function migrateCopyJson(
  copyJson: ContentFactoryCopyJson | null,
  draft: {
    title: string | null
    body: string | null
    platform: RecommendPlatform
  }
): ContentFactoryCopyJson {
  const json: ContentFactoryCopyJson = { ...(copyJson ?? {}) }
  const variants: Partial<Record<RecommendPlatform, PlatformVariant>> = {
    ...(json.platform_variants ?? {}),
  }

  if (!json.source_body?.trim() && draft.body?.trim()) {
    json.source_title = draft.title
    json.source_body = draft.body
  }

  const current = variants[draft.platform]
  if (!current?.body?.trim() && draft.body?.trim()) {
    variants[draft.platform] = {
      title: draft.title,
      body: draft.body,
      title_options: json.title_options ?? [],
      highlight_tags: json.highlight_tags ?? [],
    }
  }

  json.platform_variants = variants
  return json
}

export function readViewContent(
  copyJson: ContentFactoryCopyJson | null,
  view: ContentFactoryView
): ViewContent {
  if (view === "source") {
    return {
      title: copyJson?.source_title ?? "",
      body: copyJson?.source_body ?? "",
      titleOptions: [],
      highlightTags: [],
    }
  }

  const variant = copyJson?.platform_variants?.[view]
  return {
    title: variant?.title ?? "",
    body: variant?.body ?? "",
    titleOptions: variant?.title_options ?? [],
    highlightTags: variant?.highlight_tags ?? [],
  }
}

export function writeViewContent(
  copyJson: ContentFactoryCopyJson | null,
  view: ContentFactoryView,
  content: ViewContent
): ContentFactoryCopyJson {
  const json: ContentFactoryCopyJson = { ...(copyJson ?? {}) }

  if (view === "source") {
    json.source_title = content.title || null
    json.source_body = content.body
    return json
  }

  const variants: Partial<Record<RecommendPlatform, PlatformVariant>> = {
    ...(json.platform_variants ?? {}),
  }
  variants[view] = {
    title: content.title || null,
    body: content.body,
    title_options: content.titleOptions,
    highlight_tags: content.highlightTags,
  }
  json.platform_variants = variants
  return json
}

export function applyGeneratedCopyToView(
  copyJson: ContentFactoryCopyJson | null,
  view: ContentFactoryView,
  generated: ContentFactoryCopyJson
): ContentFactoryCopyJson {
  const title = generated.title_options?.[0] ?? ""
  const body = generated.body ?? ""
  const next = writeViewContent(copyJson, view, {
    title,
    body,
    titleOptions: generated.title_options ?? [],
    highlightTags: generated.highlight_tags ?? [],
  })

  if (isPlatformView(view)) {
    next.platform_variants = {
      ...(next.platform_variants ?? {}),
      [view]: {
        title: title || null,
        body,
        title_options: generated.title_options ?? [],
        highlight_tags: generated.highlight_tags ?? [],
      },
    }
  }

  return next
}

export function defaultContentView(platform: RecommendPlatform): ContentFactoryView {
  return platform
}

export function platformLabel(view: ContentFactoryView): string {
  if (view === "source") {
    return "原文"
  }
  return RECOMMEND_PLATFORMS.find((p) => p.id === view)?.label ?? view
}

export function draftHasWorkbenchContent(
  draft: { body: string | null; step: number },
  copyJson: ContentFactoryCopyJson | null
): boolean {
  if (draft.body?.trim()) {
    return true
  }
  if (copyJson?.source_body?.trim()) {
    return true
  }
  const variants = copyJson?.platform_variants
  if (variants) {
    for (const variant of Object.values(variants)) {
      if (variant?.body?.trim()) {
        return true
      }
    }
  }
  return draft.step >= 3
}

export function platformVariantNeedsLayout(
  copyJson: ContentFactoryCopyJson | null,
  platform: RecommendPlatform
): boolean {
  const variantBody = copyJson?.platform_variants?.[platform]?.body?.trim()
  const sourceBody = copyJson?.source_body?.trim()
  return !variantBody && Boolean(sourceBody)
}

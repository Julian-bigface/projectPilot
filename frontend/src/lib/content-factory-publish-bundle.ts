import type { ContentFactoryCopyJson } from "@/types/content-factory"

export type XhsPublishDraftInput = {
  title: string | null
  body: string | null
  body_json: ContentFactoryCopyJson | null
}

function normalizeHashtag(tag: string): string {
  const trimmed = tag.replace(/^#/, "").trim()
  return trimmed ? `#${trimmed}` : ""
}

export function buildXhsPublishBundle(draft: XhsPublishDraftInput): string {
  const variant = draft.body_json?.platform_variants?.xiaohongshu
  const title = (variant?.title ?? draft.title ?? "").trim()
  const body = (variant?.body ?? draft.body ?? "").trim()
  const tags = variant?.highlight_tags ?? draft.body_json?.highlight_tags ?? []
  const tagLine = tags.map(normalizeHashtag).filter(Boolean).join(" ")

  const parts: string[] = []
  if (title) {
    parts.push(title)
  }
  if (body) {
    if (parts.length > 0) {
      parts.push("")
    }
    parts.push(body)
  }
  if (tagLine) {
    if (parts.length > 0) {
      parts.push("")
    }
    parts.push(tagLine)
  }
  return parts.join("\n")
}

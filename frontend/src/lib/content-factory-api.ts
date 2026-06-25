import { plApiPath } from "@/lib/pl-api"
import type {
  ContentFactoryCopyJson,
  ContentFactoryCoverStyle,
  ContentFactoryDraft,
  CoverStyleDesignAnalysis,
  GenerateCopyResponse,
  UploadCoverResponse,
  OptimizeSelectionResponse,
  RecommendPlatform,
} from "@/types/content-factory"

function draftsBase(libraryId: number): string {
  return plApiPath(libraryId, "/content-factory/drafts")
}

export async function fetchContentFactoryDrafts(
  libraryId: number
): Promise<ContentFactoryDraft[]> {
  const res = await fetch(draftsBase(libraryId))
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`)
  }
  return res.json() as Promise<ContentFactoryDraft[]>
}

export async function createContentFactoryDraft(
  libraryId: number,
  body: { project_id: number; platform?: RecommendPlatform }
): Promise<ContentFactoryDraft> {
  const res = await fetch(draftsBase(libraryId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<ContentFactoryDraft>
}

export async function fetchContentFactoryDraft(
  libraryId: number,
  draftId: number
): Promise<ContentFactoryDraft> {
  const res = await fetch(`${draftsBase(libraryId)}/${draftId}`)
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`)
  }
  return res.json() as Promise<ContentFactoryDraft>
}

export async function patchContentFactoryDraft(
  libraryId: number,
  draftId: number,
  body: Partial<{
    platform: RecommendPlatform
    step: number
    title: string | null
    body: string | null
    body_json: ContentFactoryCopyJson | null
    status: "draft" | "generated"
  }>
): Promise<ContentFactoryDraft> {
  const res = await fetch(`${draftsBase(libraryId)}/${draftId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`)
  }
  return res.json() as Promise<ContentFactoryDraft>
}

export async function deleteContentFactoryDraft(
  libraryId: number,
  draftId: number
): Promise<void> {
  const res = await fetch(`${draftsBase(libraryId)}/${draftId}`, { method: "DELETE" })
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`)
  }
}

export async function optimizeContentFactorySelection(
  libraryId: number,
  draftId: number,
  body: { selected_text: string; full_body?: string | null }
): Promise<OptimizeSelectionResponse> {
  const res = await fetch(`${draftsBase(libraryId)}/${draftId}/optimize-selection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<OptimizeSelectionResponse>
}

export async function generateContentFactoryCopy(
  libraryId: number,
  draftId: number,
  body: {
    preview_only?: boolean
    regenerate?: boolean
    platform?: RecommendPlatform
    from_source?: boolean
  } = {}
): Promise<GenerateCopyResponse> {
  const res = await fetch(`${draftsBase(libraryId)}/${draftId}/generate-copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<GenerateCopyResponse>
}

export async function generateContentFactoryAiCover(
  libraryId: number,
  draftId: number,
  body: {
    style_id: string
    size_preset_id: string
    force?: boolean
  }
): Promise<UploadCoverResponse> {
  const res = await fetch(`${draftsBase(libraryId)}/${draftId}/generate-ai-cover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<UploadCoverResponse>
}

export async function fetchContentFactoryCoverStyles(
  libraryId: number,
  options?: { includeHidden?: boolean }
): Promise<{ items: ContentFactoryCoverStyle[] }> {
  const params = new URLSearchParams()
  if (options?.includeHidden) {
    params.set("include_hidden", "true")
  }
  const qs = params.toString()
  const res = await fetch(
    plApiPath(libraryId, `/content-factory/cover-styles${qs ? `?${qs}` : ""}`)
  )
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`)
  }
  return res.json() as Promise<{ items: ContentFactoryCoverStyle[] }>
}

export function contentFactoryCoverStyleExampleUrl(
  libraryId: number,
  styleId: string,
  cacheBust?: string | number
): string {
  const base = plApiPath(libraryId, `/content-factory/cover-styles/${encodeURIComponent(styleId)}/example`)
  if (cacheBust == null || cacheBust === "") {
    return base
  }
  return `${base}?t=${encodeURIComponent(String(cacheBust))}`
}

export async function createContentFactoryCoverStyle(
  libraryId: number,
  body: {
    style_id?: string
    label: string
    prompt_prefix: string
    prompt_template: string
    negative_prompt?: string
    color_tokens?: ContentFactoryCoverStyle["color_tokens"]
    font_tokens?: ContentFactoryCoverStyle["font_tokens"]
    style_report?: string | null
    fork_from_style_id?: string | null
  }
): Promise<ContentFactoryCoverStyle> {
  const res = await fetch(plApiPath(libraryId, "/content-factory/cover-styles"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<ContentFactoryCoverStyle>
}

export async function patchContentFactoryCoverStyle(
  libraryId: number,
  styleId: string,
  body: Partial<{
    label: string
    prompt_prefix: string
    prompt_template: string
    negative_prompt: string
    color_tokens: ContentFactoryCoverStyle["color_tokens"]
    font_tokens: ContentFactoryCoverStyle["font_tokens"]
    style_report: string | null
    design_analysis?: CoverStyleDesignAnalysis | null
    hidden: boolean
  }>
): Promise<ContentFactoryCoverStyle> {
  const res = await fetch(
    plApiPath(libraryId, `/content-factory/cover-styles/${encodeURIComponent(styleId)}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<ContentFactoryCoverStyle>
}

export async function deleteContentFactoryCoverStyle(
  libraryId: number,
  styleId: string
): Promise<void> {
  const res = await fetch(
    plApiPath(libraryId, `/content-factory/cover-styles/${encodeURIComponent(styleId)}`),
    { method: "DELETE" }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
}

export async function uploadCoverStyleReference(
  libraryId: number,
  file: File
): Promise<{ reference_id: string; preview_url: string }> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(plApiPath(libraryId, "/content-factory/cover-styles/reference-upload"), {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<{ reference_id: string; preview_url: string }>
}

export async function generateContentFactoryCoverStyle(
  libraryId: number,
  body: {
    generation_brief?: string | null
    reference_id?: string | null
    fork_from_style_id?: string | null
    generate_example?: boolean
    auto_save?: boolean
  }
): Promise<ContentFactoryCoverStyle> {
  const res = await fetch(plApiPath(libraryId, "/content-factory/cover-styles/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<ContentFactoryCoverStyle>
}

export type StreamCoverStyleGenerateOptions = {
  signal?: AbortSignal
  onEvent: (event: import("@/types/content-factory").CoverStyleGenerateStreamEvent) => void
}

export async function streamContentFactoryCoverStyleGenerate(
  libraryId: number,
  body: {
    generation_brief?: string | null
    reference_id?: string | null
    fork_from_style_id?: string | null
  },
  options: StreamCoverStyleGenerateOptions
): Promise<void> {
  const res = await fetch(plApiPath(libraryId, "/content-factory/cover-styles/generate/stream"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  if (!res.body) {
    throw new Error("无响应体")
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      options.onEvent(
        JSON.parse(trimmed) as import("@/types/content-factory").CoverStyleGenerateStreamEvent
      )
    }
  }

  const tail = buffer.trim()
  if (tail) {
    options.onEvent(
      JSON.parse(tail) as import("@/types/content-factory").CoverStyleGenerateStreamEvent
    )
  }
}

export async function saveParsedContentFactoryCoverStyle(
  libraryId: number,
  body: {
    name: string
    prompt_prefix: string
    prompt_template: string
    negative_prompt: string
    style_report?: string | null
    design_analysis?: CoverStyleDesignAnalysis | null
    reference_id?: string | null
    fork_from_style_id?: string | null
    generate_example?: boolean
  }
): Promise<ContentFactoryCoverStyle> {
  const res = await fetch(plApiPath(libraryId, "/content-factory/cover-styles/save-parsed"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<ContentFactoryCoverStyle>
}

export async function refineContentFactoryCoverStyle(
  libraryId: number,
  body: {
    instruction: string
    label?: string | null
    design_analysis?: CoverStyleDesignAnalysis | null
    prompt_prefix: string
    prompt_template: string
    negative_prompt?: string
    color_tokens?: ContentFactoryCoverStyle["color_tokens"]
    font_tokens?: ContentFactoryCoverStyle["font_tokens"]
    style_report?: string | null
  }
): Promise<{
  design_analysis: CoverStyleDesignAnalysis
  prompt_prefix: string
  prompt_template: string
  negative_prompt: string
  color_tokens: ContentFactoryCoverStyle["color_tokens"]
  font_tokens: ContentFactoryCoverStyle["font_tokens"]
  style_report: string
}> {
  const res = await fetch(plApiPath(libraryId, "/content-factory/cover-styles/refine"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json()
}

export async function refineContentFactoryCoverStylePromptTemplate(
  libraryId: number,
  body: {
    prompt_template: string
    instruction: string
    prompt_prefix?: string | null
  }
): Promise<{ prompt_template: string }> {
  const res = await fetch(
    plApiPath(libraryId, "/content-factory/cover-styles/refine-prompt-template"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<{ prompt_template: string }>
}

export async function previewContentFactoryCoverStyle(
  libraryId: number,
  styleId: string,
  body?: { size_preset_id?: string; force?: boolean }
): Promise<{ style_id: string; example_image_url: string }> {
  const res = await fetch(
    plApiPath(libraryId, `/content-factory/cover-styles/${encodeURIComponent(styleId)}/preview`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<{ style_id: string; example_image_url: string }>
}

export async function forkContentFactoryCoverStyle(
  libraryId: number,
  styleId: string,
  body?: { label?: string; hidden_source?: boolean }
): Promise<ContentFactoryCoverStyle> {
  const res = await fetch(
    plApiPath(libraryId, `/content-factory/cover-styles/${encodeURIComponent(styleId)}/fork`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<ContentFactoryCoverStyle>
}

export type ContentFactoryCoverUrlOptions = {
  styleId: string
  sizePresetId: string
  cacheBust?: string | number
}

export function contentFactoryCoverUrl(
  libraryId: number,
  draftId: number,
  options: ContentFactoryCoverUrlOptions
): string {
  const params = new URLSearchParams({
    style_id: options.styleId,
    size_preset_id: options.sizePresetId,
  })
  if (options.cacheBust != null && options.cacheBust !== "") {
    params.set("t", String(options.cacheBust))
  }
  return `${draftsBase(libraryId)}/${draftId}/cover?${params.toString()}`
}

export async function revealContentFactoryCover(
  libraryId: number,
  draftId: number,
  options: { styleId: string; sizePresetId: string }
): Promise<{ absolute_path: string; directory: string }> {
  const params = new URLSearchParams({
    style_id: options.styleId,
    size_preset_id: options.sizePresetId,
  })
  const res = await fetch(
    `${draftsBase(libraryId)}/${draftId}/reveal-cover?${params.toString()}`,
    { method: "POST" }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<{ absolute_path: string; directory: string }>
}

export async function uploadContentFactoryCover(
  libraryId: number,
  draftId: number,
  body: { file: Blob; readme_sha: string; size_preset_id?: string; force?: boolean }
): Promise<UploadCoverResponse> {
  const form = new FormData()
  form.append("file", body.file, "cover.png")
  form.append("readme_sha", body.readme_sha)
  form.append("size_preset_id", body.size_preset_id ?? "xiaohongshu-34")
  form.append("force", body.force ? "true" : "false")
  const res = await fetch(`${draftsBase(libraryId)}/${draftId}/upload-cover`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json() as Promise<UploadCoverResponse>
}

export function formatStars(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`
  }
  return String(n)
}

export function buildExportMarkdown(draft: ContentFactoryDraft): string {
  const copy = draft.body_json
  const lines = [
    `# ${draft.title || draft.project.name} 推荐稿`,
    "",
    `> 平台：${draft.platform} | 仓库：${draft.project.full_name}`,
    "",
    "## 正文",
    "",
    draft.body || "(空)",
    "",
  ]
  if (copy?.hashtags?.length) {
    lines.push("## 话题标签", "", copy.hashtags.join(" "), "")
  }
  if (copy?.hook) {
    lines.push("## 一句话亮点", "", copy.hook, "")
  }
  if (copy?.cta) {
    lines.push("## 行动号召", "", copy.cta, "")
  }
  return lines.join("\n")
}

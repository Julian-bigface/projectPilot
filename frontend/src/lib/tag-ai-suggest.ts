import type {
  TagCategoryApplyItem,
  TagCategoryApplyResponse,
  TagCategorySuggestRequest,
  TagCategorySuggestResponse,
  TagCategorySuggestStreamEvent,
} from "@/types/tag-ai"

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json()
    if (data && typeof data === "object" && "detail" in data) {
      const d = (data as { detail: unknown }).detail
      if (typeof d === "string") {
        return d
      }
      return JSON.stringify(d)
    }
  } catch {
    // ignore
  }
  return res.statusText || `HTTP ${res.status}`
}

export async function postTagSuggestCategories(
  libraryPath: (suffix: string) => string,
  body: TagCategorySuggestRequest = {}
): Promise<TagCategorySuggestResponse> {
  const res = await fetch(libraryPath("/tags/suggest-categories"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<TagCategorySuggestResponse>
}

export type StreamTagSuggestCategoriesOptions = {
  signal?: AbortSignal
  onEvent: (event: TagCategorySuggestStreamEvent) => void
}

export async function streamTagSuggestCategories(
  libraryPath: (suffix: string) => string,
  body: TagCategorySuggestRequest,
  options: StreamTagSuggestCategoriesOptions
): Promise<void> {
  const res = await fetch(libraryPath("/tags/suggest-categories/stream"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
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
      options.onEvent(JSON.parse(trimmed) as TagCategorySuggestStreamEvent)
    }
  }

  const tail = buffer.trim()
  if (tail) {
    options.onEvent(JSON.parse(tail) as TagCategorySuggestStreamEvent)
  }
}

export async function postTagApplyCategorySuggestions(
  libraryPath: (suffix: string) => string,
  items: TagCategoryApplyItem[]
): Promise<TagCategoryApplyResponse> {
  const res = await fetch(libraryPath("/tags/apply-category-suggestions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<TagCategoryApplyResponse>
}

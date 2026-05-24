import type { ParsedGithubRepo } from "@/lib/github-url"

export type GithubRepoPreview = {
  full_name: string | null
  description: string | null
  fetched: boolean
  error: string | null
}

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

export async function fetchGithubRepoPreview(
  parsed: ParsedGithubRepo,
  signal?: AbortSignal
): Promise<GithubRepoPreview> {
  const url = `/api/projects/preview-github?github_url=${encodeURIComponent(parsed.normalizedUrl)}`
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err
    }
    return {
      full_name: parsed.full_name,
      description: null,
      fetched: false,
      error: "网络请求失败，请检查网络连接或确认后端已启动。",
    }
  }
  if (!res.ok) {
    return {
      full_name: parsed.full_name,
      description: null,
      fetched: false,
      error: await parseErrorMessage(res),
    }
  }
  return (await res.json()) as GithubRepoPreview
}

export type GithubSettingsRead = {
  has_token: boolean
  token_preview: string | null
  token_length: number | null
}

export type GithubSettingsUpdate = {
  token: string | null
}

export type GithubProfileRead = {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
}

export type GithubTestRequest = {
  token?: string | null
}

export type GithubTestResponse = {
  ok: boolean
  message?: string | null
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

export async function fetchGithubSettings(): Promise<GithubSettingsRead> {
  const res = await fetch("/api/settings/github")
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<GithubSettingsRead>
}

export async function putGithubSettings(body: GithubSettingsUpdate): Promise<GithubSettingsRead> {
  const res = await fetch("/api/settings/github", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<GithubSettingsRead>
}

export async function fetchGithubProfile(): Promise<GithubProfileRead> {
  const res = await fetch("/api/settings/github/profile")
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<GithubProfileRead>
}

export async function postGithubTest(token?: string): Promise<GithubTestResponse> {
  const body: GithubTestRequest | undefined =
    token !== undefined && token.trim() !== "" ? { token: token.trim() } : undefined
  const res = await fetch("/api/settings/github/test", {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<GithubTestResponse>
}

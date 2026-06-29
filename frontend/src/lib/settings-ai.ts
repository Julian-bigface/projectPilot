export type AiScenarioBinding = {
  provider_id: string | null
  model: string | null
}

export type AiProviderRead = {
  id: string
  name: string
  preset_id: string
  provider: string
  base_url: string
  models: string[]
  default_model: string
  has_api_key: boolean
  api_key?: string | null
  api_key_preview?: string | null
  api_key_length?: number | null
  is_default: boolean
}

export type AiProviderWrite = {
  id?: string | null
  name: string
  preset_id: string
  provider?: string
  base_url: string
  models: string[]
  default_model: string
  api_key?: string | null
}

export type AiConfigRead = {
  providers: AiProviderRead[]
  default_provider_id: string | null
  scenarios: Record<string, AiScenarioBinding>
  scenario_labels: Record<string, string>
  supported_providers: string[]
}

export type AiConfigUpdate = {
  providers: AiProviderWrite[]
  default_provider_id: string
  scenarios: Record<string, AiScenarioBinding>
}

export type AiSettingsRead = {
  provider: string
  preset_id: string
  base_url: string
  model: string
  has_api_key: boolean
  api_key_preview?: string | null
  api_key_length?: number | null
  supported_providers: string[]
  default_provider: string
  default_preset_id: string
  default_base_url: string
  default_model: string
}

export type AiTestResponse = {
  ok: boolean
  message?: string | null
  sample?: string | null
}

export const AI_SCENARIO_IDS = [
  "tag_classification",
  "recommend_copy",
  "recommend_image",
  "recommend_cover_style",
] as const

export type AiScenarioId = (typeof AI_SCENARIO_IDS)[number]

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

export async function fetchAiConfig(): Promise<AiConfigRead> {
  const res = await fetch("/api/settings/ai/config")
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<AiConfigRead>
}

export async function putAiConfig(body: AiConfigUpdate): Promise<AiConfigRead> {
  const res = await fetch("/api/settings/ai/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<AiConfigRead>
}

export async function postAiTest(options?: {
  providerId?: string
  scenarioId?: string
}): Promise<AiTestResponse> {
  const params = new URLSearchParams()
  if (options?.providerId) {
    params.set("provider_id", options.providerId)
  }
  if (options?.scenarioId) {
    params.set("scenario_id", options.scenarioId)
  }
  const qs = params.toString()
  const res = await fetch(`/api/settings/ai/test${qs ? `?${qs}` : ""}`, { method: "POST" })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<AiTestResponse>
}

/** @deprecated 遗留单供应商 API，请使用 fetchAiConfig / putAiConfig */
export async function fetchAiSettings(): Promise<AiSettingsRead> {
  const res = await fetch("/api/settings/ai")
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<AiSettingsRead>
}

/** @deprecated 遗留单供应商 API，请使用 putAiConfig */
export async function putAiSettings(body: {
  provider?: string
  preset_id?: string
  base_url?: string
  model?: string
  api_key?: string | null
}): Promise<AiSettingsRead> {
  const res = await fetch("/api/settings/ai", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<AiSettingsRead>
}

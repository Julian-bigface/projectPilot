export type TranslationSettingsRead = {
  provider: string
  target_lang: string
  supported_target_langs: string[]
}

export type TranslationSettingsUpdate = {
  target_lang: string
}

export type TranslationTestResponse = {
  ok: boolean
  sample?: string | null
  message?: string | null
}

export const TRANSLATION_TARGET_LANG_LABELS: Record<string, string> = {
  "zh-CN": "简体中文",
  "zh-TW": "繁体中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
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

export async function fetchTranslationSettings(): Promise<TranslationSettingsRead> {
  const res = await fetch("/api/settings/translation")
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<TranslationSettingsRead>
}

export async function putTranslationSettings(
  body: TranslationSettingsUpdate
): Promise<TranslationSettingsRead> {
  const res = await fetch("/api/settings/translation", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<TranslationSettingsRead>
}

export async function postTranslationTest(): Promise<TranslationTestResponse> {
  const res = await fetch("/api/settings/translation/test", { method: "POST" })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<TranslationTestResponse>
}

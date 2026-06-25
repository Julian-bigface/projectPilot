export const SETTINGS_SCROLL_SECTIONS = [
  { id: "general", label: "通用" },
  { id: "translation", label: "翻译" },
] as const

export type SettingsScrollSectionId = (typeof SETTINGS_SCROLL_SECTIONS)[number]["id"]

export const SETTINGS_AI_ROUTE = {
  id: "ai",
  label: "AI",
  path: "/settings/ai",
} as const

export type SettingsNavId = SettingsScrollSectionId | typeof SETTINGS_AI_ROUTE.id

export function isSettingsScrollSectionId(value: string): value is SettingsScrollSectionId {
  return SETTINGS_SCROLL_SECTIONS.some((section) => section.id === value)
}

/** 旧锚点 `#github` 已改为独立弹窗；`#ai` 已改为独立路由页。 */
export function resolveSettingsScrollSectionId(hash: string): SettingsScrollSectionId {
  const id = hash.replace(/^#/, "")
  if (id === "github" || id === "ai") return "general"
  return isSettingsScrollSectionId(id) ? id : "general"
}

export function isSettingsAiPath(pathname: string): boolean {
  return pathname === SETTINGS_AI_ROUTE.path || pathname.startsWith(`${SETTINGS_AI_ROUTE.path}/`)
}

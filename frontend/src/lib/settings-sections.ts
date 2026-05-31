export const SETTINGS_SECTIONS = [
  { id: "general", label: "通用" },
  { id: "translation", label: "翻译" },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"]

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value)
}

/** 旧锚点 `#github` 已改为独立弹窗，滚动时映射到通用分区。 */
export function resolveSettingsScrollSectionId(hash: string): SettingsSectionId {
  const id = hash.replace(/^#/, "")
  if (id === "github") return "general"
  return isSettingsSectionId(id) ? id : "general"
}

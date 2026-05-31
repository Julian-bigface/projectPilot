export const THEME_CYCLE_ORDER = ["light", "dark", "system"] as const

export type ThemeCycleValue = (typeof THEME_CYCLE_ORDER)[number]

export function nextThemeValue(current: string | undefined): ThemeCycleValue {
  const normalized = THEME_CYCLE_ORDER.includes(current as ThemeCycleValue)
    ? (current as ThemeCycleValue)
    : "system"
  const index = THEME_CYCLE_ORDER.indexOf(normalized)
  return THEME_CYCLE_ORDER[(index + 1) % THEME_CYCLE_ORDER.length]
}

export const THEME_CYCLE_LABELS: Record<ThemeCycleValue, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
}

export const SETTINGS_AI_ROUTE = {
  id: "ai",
  label: "AI 工作室",
  path: "/settings/ai",
} as const

export function isSettingsAiPath(pathname: string): boolean {
  return pathname === SETTINGS_AI_ROUTE.path || pathname.startsWith(`${SETTINGS_AI_ROUTE.path}/`)
}

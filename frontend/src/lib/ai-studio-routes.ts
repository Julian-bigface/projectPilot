export const AI_STUDIO_BASE = "/settings/ai"

export const AI_STUDIO_ROUTES = {
  overview: AI_STUDIO_BASE,
  providers: `${AI_STUDIO_BASE}/providers`,
  providerDetail: (id: string) => `${AI_STUDIO_BASE}/providers/${id}`,
  capabilities: `${AI_STUDIO_BASE}/capabilities`,
} as const

export type AiStudioNavId = "overview" | "providers" | "capabilities"

export const AI_STUDIO_NAV: { id: AiStudioNavId; label: string; path: string }[] = [
  { id: "overview", label: "总览", path: AI_STUDIO_ROUTES.overview },
  { id: "providers", label: "供应商", path: AI_STUDIO_ROUTES.providers },
  { id: "capabilities", label: "能力", path: AI_STUDIO_ROUTES.capabilities },
]

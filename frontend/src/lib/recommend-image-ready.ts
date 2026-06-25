import { isVisionModel } from "@/lib/ai-provider-presets"
import type { AiConfigRead } from "@/lib/settings-ai"

function resolveScenarioProvider(
  config: AiConfigRead,
  scenarioId: keyof AiConfigRead["scenarios"]
) {
  const binding = config.scenarios[scenarioId]
  const providerId = binding?.provider_id ?? config.default_provider_id
  if (!providerId) {
    return null
  }
  const provider = config.providers.find((p) => p.id === providerId)
  if (!provider) {
    return null
  }
  const model = binding?.model ?? provider.default_model
  return { provider, model }
}

export function isRecommendImageReady(config: AiConfigRead | undefined): boolean {
  if (!config) {
    return false
  }
  const resolved = resolveScenarioProvider(config, "recommend_image")
  return Boolean(resolved?.provider.has_api_key)
}

export function isRecommendCoverStyleReady(config: AiConfigRead | undefined): boolean {
  if (!config) {
    return false
  }
  const resolved = resolveScenarioProvider(config, "recommend_cover_style")
  return Boolean(resolved?.provider.has_api_key)
}

export function isRecommendCoverStyleVisionReady(config: AiConfigRead | undefined): boolean {
  if (!isRecommendCoverStyleReady(config) || !config) {
    return false
  }
  const resolved = resolveScenarioProvider(config, "recommend_cover_style")
  if (!resolved) {
    return false
  }
  return isVisionModel(resolved.model, resolved.provider.preset_id)
}

export function getRecommendCoverStyleBinding(config: AiConfigRead | undefined) {
  if (!config) {
    return null
  }
  return resolveScenarioProvider(config, "recommend_cover_style")
}

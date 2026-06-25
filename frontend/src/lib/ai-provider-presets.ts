/** AI 供应商预设（对齐 RedBox `aiSources.ts` 常用子集） */

export type AiProtocol = "openai_compatible"

export type AiProviderPreset = {
  id: string
  label: string
  sourceName: string
  baseUrl: string
  protocol: AiProtocol
  defaultModel: string
  models: string[]
  visionModels?: string[]
  apiKeyHint?: string
  docUrl?: string
}

export const DEFAULT_AI_PRESET_ID = "minimax-cn"

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: "minimax-cn",
    label: "MiniMax（国内）",
    sourceName: "MiniMax",
    baseUrl: "https://api.minimaxi.com/v1",
    protocol: "openai_compatible",
    defaultModel: "MiniMax-M2.5-highspeed",
    models: [
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.5",
      "MiniMax-M2.1-highspeed",
      "MiniMax-M2.1",
      "MiniMax-M2.7-highspeed",
      "MiniMax-M2.7",
      "MiniMax-M3",
      "MiniMax-VL-01",
      "MiniMax-M2",
    ],
    visionModels: ["MiniMax-M3", "MiniMax-VL-01"],
    apiKeyHint: "在 platform.minimaxi.com 创建 API Key",
    docUrl: "https://platform.minimaxi.com/docs/api-reference/text-openai-api",
  },
  {
    id: "minimax-global",
    label: "MiniMax（国际）",
    sourceName: "MiniMax Global",
    baseUrl: "https://api.minimax.io/v1",
    protocol: "openai_compatible",
    defaultModel: "MiniMax-M2.5-highspeed",
    models: [
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.5",
      "MiniMax-M2.1-highspeed",
      "MiniMax-M2.1",
      "MiniMax-M3",
      "MiniMax-VL-01",
    ],
    visionModels: ["MiniMax-M3", "MiniMax-VL-01"],
    apiKeyHint: "在 platform.minimax.io 创建 API Key",
    docUrl: "https://platform.minimax.io/docs/api-reference/text-openai-api",
  },
  {
    id: "openai",
    label: "OpenAI",
    sourceName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai_compatible",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    visionModels: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    sourceName: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    protocol: "openai_compatible",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "ollama-local",
    label: "Ollama（本地）",
    sourceName: "Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    protocol: "openai_compatible",
    defaultModel: "llama3",
    models: ["llama3", "qwen2.5", "mistral", "llava", "qwen2-vl"],
    visionModels: ["llava", "qwen2-vl", "bakllava"],
    apiKeyHint: "本地可留空或填占位符",
  },
  {
    id: "rootflowai-image",
    label: "RootFlowAI（生图）",
    sourceName: "RootFlowAI",
    baseUrl: "https://api.rootflowai.com/v1",
    protocol: "openai_compatible",
    defaultModel: "gemini-3.1-flash-image-count",
    models: [
      "gemini-3.1-flash-image-count",
      "gemini-3.1-flash-image-hd-count",
      "gemini-3-pro-image-count",
      "gemini-3-pro-image-hd-count",
      "gemini-2.5-flash-image-count",
      "gpt-image-2-count",
      "gpt-image-2-hd-count",
    ],
    visionModels: [
      "gemini-3.1-flash-image-count",
      "gemini-3.1-flash-image-hd-count",
      "gemini-3-pro-image-count",
      "gemini-3-pro-image-hd-count",
      "gemini-2.5-flash-image-count",
    ],
    apiKeyHint:
      "令牌分组：Gemini 模型选「Gemini绘图计次」，GPT 模型选「GPT绘图计次」；模型名须带 -count 后缀",
    docUrl: "https://rootflowai.com/docs/guide/image-generation",
  },
  {
    id: "custom",
    label: "自定义",
    sourceName: "Custom",
    baseUrl: "",
    protocol: "openai_compatible",
    defaultModel: "",
    models: [],
  },
]

export function findAiPresetById(id: string): AiProviderPreset | undefined {
  return AI_PROVIDER_PRESETS.find((p) => p.id === id)
}

export function inferPresetIdFromBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "").toLowerCase()
  if (!normalized) return DEFAULT_AI_PRESET_ID

  const exact = AI_PROVIDER_PRESETS.find(
    (p) => p.baseUrl && p.baseUrl.replace(/\/+$/, "").toLowerCase() === normalized
  )
  if (exact) return exact.id

  if (normalized.includes("minimaxi.com")) return "minimax-cn"
  if (normalized.includes("minimax.io")) return "minimax-global"
  if (normalized.includes("openai.com")) return "openai"
  if (normalized.includes("deepseek.com")) return "deepseek"
  if (normalized.includes("rootflowai.com")) return "rootflowai-image"
  if (normalized.includes("11434")) return "ollama-local"

  return "custom"
}

export const AI_PROTOCOL_LABELS: Record<AiProtocol, string> = {
  openai_compatible: "OpenAI 兼容",
}

const VISION_MODEL_HEURISTICS =
  /gpt-4o|gpt-4\.1|claude-3|claude-sonnet|claude-opus|gemini|qwen-vl|qwen2-vl|vision|vl-|minimax-vl|MiniMax-M3|MiniMax-VL/i

export function isVisionModel(model: string, presetId?: string | null): boolean {
  const name = model.trim()
  if (!name) {
    return false
  }
  const preset = presetId ? findAiPresetById(presetId) : undefined
  if (preset?.visionModels?.includes(name)) {
    return true
  }
  return VISION_MODEL_HEURISTICS.test(name)
}

import { describe, expect, it } from "vitest"

import {
  countReadyScenarios,
  isScenarioReady,
  providerHealthSummary,
  resolveScenarioDisplay,
} from "@/lib/ai-config-status"
import type { AiConfigRead } from "@/lib/settings-ai"

function makeConfig(overrides: Partial<AiConfigRead> = {}): AiConfigRead {
  return {
    providers: [
      {
        id: "default",
        name: "MiniMax",
        preset_id: "minimax-cn",
        provider: "openai_compatible",
        base_url: "https://api.minimaxi.com/v1",
        models: ["MiniMax-M2.5-highspeed"],
        default_model: "MiniMax-M2.5-highspeed",
        has_api_key: true,
        is_default: true,
      },
    ],
    default_provider_id: "default",
    scenarios: {
      tag_classification: { provider_id: "default", model: "MiniMax-M2.5-highspeed" },
      recommend_copy: { provider_id: "default", model: "MiniMax-M2.5-highspeed" },
      recommend_image: { provider_id: "default", model: "MiniMax-M2.5-highspeed" },
      recommend_cover_style: { provider_id: "default", model: "MiniMax-M2.5-highspeed" },
    },
    scenario_labels: {
      tag_classification: "标签整理",
      recommend_copy: "内容工厂推荐话术",
      recommend_image: "推荐配图",
      recommend_cover_style: "封面风格生成",
    },
    supported_providers: ["openai_compatible"],
    ...overrides,
  }
}

describe("isScenarioReady", () => {
  it("returns true when provider has key and model is set", () => {
    expect(isScenarioReady(makeConfig(), "tag_classification")).toBe(true)
  })

  it("returns false when provider missing key", () => {
    const config = makeConfig({
      providers: [
        {
          ...makeConfig().providers[0],
          has_api_key: false,
        },
      ],
    })
    expect(isScenarioReady(config, "tag_classification")).toBe(false)
  })

  it("returns false when model is missing", () => {
    const config = makeConfig({
      scenarios: {
        ...makeConfig().scenarios,
        tag_classification: { provider_id: "default", model: null },
      },
      providers: [
        {
          ...makeConfig().providers[0],
          default_model: "",
        },
      ],
    })
    expect(isScenarioReady(config, "tag_classification")).toBe(false)
  })
})

describe("countReadyScenarios", () => {
  it("counts all ready scenarios", () => {
    expect(countReadyScenarios(makeConfig())).toEqual({ ready: 4, total: 4 })
  })

  it("counts partial readiness", () => {
    const config = makeConfig({
      providers: [
        {
          ...makeConfig().providers[0],
          has_api_key: false,
        },
      ],
    })
    expect(countReadyScenarios(config)).toEqual({ ready: 0, total: 4 })
  })
})

describe("providerHealthSummary", () => {
  it("summarizes key status", () => {
    expect(providerHealthSummary(makeConfig().providers)).toEqual({
      ok: 1,
      missingKey: 0,
      total: 1,
    })
  })
})

describe("resolveScenarioDisplay", () => {
  it("resolves label and provider name", () => {
    const display = resolveScenarioDisplay(makeConfig(), "tag_classification")
    expect(display.label).toBe("标签整理")
    expect(display.providerName).toBe("MiniMax")
    expect(display.model).toBe("MiniMax-M2.5-highspeed")
    expect(display.ready).toBe(true)
  })
})

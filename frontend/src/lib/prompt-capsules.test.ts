import { describe, expect, it } from "vitest"

import { joinPromptCapsules, splitPromptCapsules } from "./prompt-capsules"

describe("splitPromptCapsules", () => {
  it("splits English comma-separated prefix", () => {
    expect(splitPromptCapsules("1242x1660, 3:4 vertical, strict margins")).toEqual([
      "1242x1660",
      "3:4 vertical",
      "strict margins",
    ])
  })

  it("splits Chinese semicolon-separated negative prompt", () => {
    expect(splitPromptCapsules("禁止渐变；禁止水印；禁止乱码")).toEqual([
      "禁止渐变",
      "禁止水印",
      "禁止乱码",
    ])
  })

  it("splits semicolon chunks and commas inside each chunk", () => {
    expect(
      splitPromptCapsules(
        "1242x1660, 3:4 vertical portrait cover, strict margins；极简编辑式 + Notion/Linear 文档气质，专业理性而具社区亲和",
      ),
    ).toEqual([
      "1242x1660",
      "3:4 vertical portrait cover",
      "strict margins",
      "极简编辑式 + Notion/Linear 文档气质",
      "专业理性而具社区亲和",
    ])
  })

  it("splits Chinese comma inside a semicolon chunk", () => {
    expect(
      splitPromptCapsules("strict margins；极简编辑式，专业理性；信息密度中偏高"),
    ).toEqual(["strict margins", "极简编辑式", "专业理性", "信息密度中偏高"])
  })
})

describe("joinPromptCapsules", () => {
  it("joins Chinese segments with semicolon", () => {
    expect(joinPromptCapsules(["禁止渐变", "禁止水印"])).toBe("禁止渐变；禁止水印")
  })

  it("joins English segments with comma", () => {
    expect(joinPromptCapsules(["1242x1660", "strict margins"])).toBe("1242x1660, strict margins")
  })
})

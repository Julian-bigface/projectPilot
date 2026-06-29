import { describe, expect, it } from "vitest"

import { buildXhsPublishBundle } from "./content-factory-publish-bundle"

describe("buildXhsPublishBundle", () => {
  it("assembles title, body, and hashtags from xiaohongshu variant", () => {
    const result = buildXhsPublishBundle({
      title: "fallback title",
      body: "fallback body",
      body_json: {
        platform_variants: {
          xiaohongshu: {
            title: "一条命令上线网站",
            body: "正文第一段",
            highlight_tags: ["开源", "#VibeCoding"],
          },
        },
      },
    })

    expect(result).toBe(
      "一条命令上线网站\n\n正文第一段\n\n#开源 #VibeCoding"
    )
  })

  it("falls back to draft title and body when variant is missing", () => {
    const result = buildXhsPublishBundle({
      title: "标题",
      body: "正文",
      body_json: null,
    })

    expect(result).toBe("标题\n\n正文")
  })

  it("returns empty string when all fields are empty", () => {
    expect(
      buildXhsPublishBundle({
        title: null,
        body: null,
        body_json: null,
      })
    ).toBe("")
  })
})

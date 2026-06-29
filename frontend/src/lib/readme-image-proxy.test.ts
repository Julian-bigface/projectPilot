import { describe, expect, it } from "vitest"

import {
  isReadmeImageProxyUrl,
  readmeImageProxyUrl,
  wrapCrossOriginReadmeImage,
} from "@/lib/readme-image-proxy"

describe("readme-image-proxy", () => {
  const origin = "http://127.0.0.1:38472"

  it("builds proxy query URL", () => {
    const target = "https://img.shields.io/badge/MIT-blue"
    expect(readmeImageProxyUrl(target)).toBe(
      `/api/projects/readme-image-proxy?url=${encodeURIComponent(target)}`
    )
  })

  it("wraps cross-origin http(s) URLs", () => {
    const external = "https://raw.githubusercontent.com/o/r/main/a.png"
    const wrapped = wrapCrossOriginReadmeImage(external, origin)
    expect(wrapped).toContain("/api/projects/readme-image-proxy")
    expect(isReadmeImageProxyUrl(wrapped)).toBe(true)
  })

  it("leaves data URLs and same-origin URLs unchanged", () => {
    expect(wrapCrossOriginReadmeImage("data:image/png;base64,abc", origin)).toBe(
      "data:image/png;base64,abc"
    )
    const sameOrigin = `${origin}/assets/logo.png`
    expect(wrapCrossOriginReadmeImage(sameOrigin, origin)).toBe(sameOrigin)
  })

  it("does not double-wrap proxy URLs", () => {
    const proxied = readmeImageProxyUrl("https://example.com/a.png")
    expect(wrapCrossOriginReadmeImage(proxied, origin)).toBe(proxied)
  })
})

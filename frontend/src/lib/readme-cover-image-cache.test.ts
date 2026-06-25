import { describe, expect, it } from "vitest"

import {
  clearCaptureImageCache,
  getCachedInlineImage,
  getCaptureImageCacheSize,
  setCachedInlineImage,
} from "@/lib/readme-cover-image-cache"

describe("readme-cover-image-cache", () => {
  it("stores and retrieves inline images by url", () => {
    clearCaptureImageCache()
    setCachedInlineImage("https://example.com/a.png", "data:image/png;base64,abc")
    expect(getCachedInlineImage("https://example.com/a.png")).toBe("data:image/png;base64,abc")
    expect(getCaptureImageCacheSize()).toBe(1)
  })
})

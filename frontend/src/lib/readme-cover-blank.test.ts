import { describe, expect, it } from "vitest"

import {
  assertCaptureSurfaceReady,
  CaptureIncompleteError,
  isSampleSetMostlyBlank,
  README_CAPTURE_CONTENT_ATTR,
} from "@/lib/readme-cover-capture"

describe("isSampleSetMostlyBlank", () => {
  it("treats all-white samples as blank", () => {
    const white = Array.from({ length: 256 }, () => [255, 255, 255] as const)
    expect(isSampleSetMostlyBlank(white)).toBe(true)
  })

  it("accepts samples with enough non-background pixels", () => {
    const mixed: Array<[number, number, number]> = Array.from({ length: 256 }, () => [
      255, 255, 255,
    ])
    mixed[0] = [20, 20, 20]
    mixed[1] = [0, 0, 0]
    expect(isSampleSetMostlyBlank(mixed)).toBe(false)
  })
})

describe("assertCaptureSurfaceReady", () => {
  it("rejects empty surface without text or images", () => {
    const content = {
      textContent: "   ",
      querySelector: () => null,
    }
    const surface = {
      scrollHeight: 400,
      querySelector: (selector: string) =>
        selector.includes(README_CAPTURE_CONTENT_ATTR) ? content : null,
      querySelectorAll: () => [],
      clientHeight: 400,
      getBoundingClientRect: () => ({ top: 0 }),
    } as unknown as HTMLElement

    expect(() => assertCaptureSurfaceReady(surface)).toThrow(CaptureIncompleteError)
  })

  it("accepts surface with text content", () => {
    const content = {
      textContent: "Hello README",
      querySelector: () => null,
    }
    const surface = {
      scrollHeight: 400,
      querySelector: (selector: string) =>
        selector.includes(README_CAPTURE_CONTENT_ATTR) ? content : null,
      querySelectorAll: () => [],
      clientHeight: 400,
      getBoundingClientRect: () => ({ top: 0 }),
    } as unknown as HTMLElement

    expect(() => assertCaptureSurfaceReady(surface)).not.toThrow()
  })
})

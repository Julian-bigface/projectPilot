import { describe, expect, it } from "vitest"

import {
  buildDescriptionTranslateJobs,
  mapTranslationsToFullNames,
} from "./translate-plain-text-batch"

describe("buildDescriptionTranslateJobs", () => {
  it("skips empty sources and already translated repos", () => {
    const { jobs, fullNamesBySource, uniqueSources } = buildDescriptionTranslateJobs(
      [
        { fullName: "a/b", source: "Hello" },
        { fullName: "c/d", source: "   " },
        { fullName: "e/f", source: "Hello" },
      ],
      new Set(["a/b"])
    )

    expect(jobs).toEqual([{ fullName: "e/f", source: "Hello" }])
    expect(uniqueSources).toEqual(["Hello"])
    expect(fullNamesBySource.get("Hello")).toEqual(["e/f"])
  })

  it("dedupes identical descriptions across repos", () => {
    const { jobs, uniqueSources, fullNamesBySource } = buildDescriptionTranslateJobs([
      { fullName: "o/r1", source: "Same text" },
      { fullName: "o/r2", source: "Same text" },
      { fullName: "o/r3", source: "Other" },
    ])

    expect(jobs).toHaveLength(3)
    expect(uniqueSources).toEqual(["Same text", "Other"])
    expect(fullNamesBySource.get("Same text")).toEqual(["o/r1", "o/r2"])
  })
})

describe("mapTranslationsToFullNames", () => {
  it("maps source translations back to all full names", () => {
    const fullNamesBySource = new Map([
      ["Hello", ["a/b", "c/d"]],
      ["Bye", ["e/f"]],
    ])
    const bySource = new Map([
      ["Hello", "你好"],
      ["Bye", "再见"],
    ])

    const result = mapTranslationsToFullNames(fullNamesBySource, bySource)
    expect(result.get("a/b")).toBe("你好")
    expect(result.get("c/d")).toBe("你好")
    expect(result.get("e/f")).toBe("再见")
  })

  it("omits failed sources", () => {
    const fullNamesBySource = new Map([["Hello", ["a/b"]]])
    const bySource = new Map<string, string>()

    const result = mapTranslationsToFullNames(fullNamesBySource, bySource)
    expect(result.size).toBe(0)
  })
})

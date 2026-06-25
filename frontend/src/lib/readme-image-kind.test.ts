import { describe, expect, it } from "vitest"

import { isReadmeBadgeImage, isReadmeHeroBadgeImage } from "./readme-image-kind"

describe("isReadmeBadgeImage", () => {
  it("detects shields.io badges", () => {
    expect(
      isReadmeBadgeImage("https://img.shields.io/github/stars/owner/repo?style=flat")
    ).toBe(true)
  })

  it("detects badge alt text", () => {
    expect(isReadmeBadgeImage("https://example.com/status.png", "CI badge")).toBe(true)
  })

  it("treats readme screenshots as content images", () => {
    expect(
      isReadmeBadgeImage(
        "https://github.com/Glup3/trendingrepos/raw/HEAD/screenshot.png",
        "trendingrepos Screenshot"
      )
    ).toBe(false)
  })

  it("treats trendshift ranking banners as content images", () => {
    expect(
      isReadmeBadgeImage(
        "https://trendshift.io/api/badge/repositories/13077",
        "Magic Resume | Trendshift"
      )
    ).toBe(false)
  })

  it("treats crowdin localized badges as small badges", () => {
    expect(
      isReadmeBadgeImage(
        "https://badges.crowdin.net/reactive-resume/localized.svg?style=flat-square",
        "Crowdin"
      )
    ).toBe(true)
  })
})

describe("isReadmeHeroBadgeImage", () => {
  it("detects trendshift ranking banners", () => {
    expect(
      isReadmeHeroBadgeImage("https://trendshift.io/api/badge/repositories/13077")
    ).toBe(true)
  })

  it("ignores shields.io badges", () => {
    expect(
      isReadmeHeroBadgeImage("https://img.shields.io/github/stars/owner/repo?style=flat")
    ).toBe(false)
  })
})

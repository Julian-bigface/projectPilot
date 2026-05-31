import { describe, expect, it } from "vitest"

import {
  readmeDirectoryFromBasePath,
  readmeRawBaseUrl,
  resolveReadmeImageSrc,
} from "@/lib/readme-media-resolve"

const GITHUB = "https://github.com/octocat/Hello-World"

describe("readmeDirectoryFromBasePath", () => {
  it("returns empty for root README", () => {
    expect(readmeDirectoryFromBasePath("README.md")).toBe("")
    expect(readmeDirectoryFromBasePath(null)).toBe("")
  })

  it("returns directory for nested README", () => {
    expect(readmeDirectoryFromBasePath("docs/README.md")).toBe("docs")
    expect(readmeDirectoryFromBasePath("docs/guide/README.md")).toBe("docs/guide")
  })
})

describe("readmeRawBaseUrl", () => {
  it("builds root raw base", () => {
    expect(readmeRawBaseUrl(GITHUB, "README.md")).toBe(
      "https://github.com/octocat/Hello-World/raw/HEAD/"
    )
  })

  it("builds nested raw base", () => {
    expect(readmeRawBaseUrl(GITHUB, "docs/README.md")).toBe(
      "https://github.com/octocat/Hello-World/raw/HEAD/docs/"
    )
  })
})

describe("resolveReadmeImageSrc", () => {
  it("keeps absolute URLs", () => {
    const url = "https://img.shields.io/badge/test-blue"
    expect(resolveReadmeImageSrc(url, GITHUB)).toBe(url)
  })

  it("resolves relative image at repo root", () => {
    const resolved = resolveReadmeImageSrc("./images/logo.png", GITHUB, "README.md")
    expect(resolved).toBe(
      "https://github.com/octocat/Hello-World/raw/HEAD/images/logo.png"
    )
  })

  it("resolves relative image under nested README", () => {
    const resolved = resolveReadmeImageSrc("./img/a.png", GITHUB, "docs/README.md")
    expect(resolved).toBe(
      "https://github.com/octocat/Hello-World/raw/HEAD/docs/img/a.png"
    )
  })

  it("resolves parent-relative paths", () => {
    const resolved = resolveReadmeImageSrc("../assets/x.png", GITHUB, "docs/README.md")
    expect(resolved).toBe(
      "https://github.com/octocat/Hello-World/raw/HEAD/assets/x.png"
    )
  })
})

import { describe, expect, it } from "vitest"

import { deepWikiProjectUrl, zreadProjectUrl } from "@/lib/project-wiki-links"

describe("project-wiki-links", () => {
  it("builds zread url from full_name", () => {
    expect(zreadProjectUrl("octocat/Hello-World")).toBe("https://zread.ai/octocat/Hello-World")
  })

  it("builds deepwiki url from github url", () => {
    expect(deepWikiProjectUrl("https://github.com/octocat/Hello-World")).toBe(
      "https://deepwiki.com/octocat/Hello-World"
    )
  })
})

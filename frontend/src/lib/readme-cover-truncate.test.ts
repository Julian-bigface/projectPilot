import { describe, expect, it } from "vitest"

import { truncateReadmeHeroMarkdown } from "@/lib/readme-cover-truncate"

describe("truncateReadmeHeroMarkdown", () => {
  it("keeps second-level headings and tables for visual crop", () => {
    const md = "# Title\n\nintro\n\n## Section\n\n| A | B |\n|---|---|\n| 1 | 2 |"
    const out = truncateReadmeHeroMarkdown(md)
    expect(out).toContain("intro")
    expect(out).toContain("## Section")
    expect(out).toContain("| A | B |")
  })

  it("keeps content after horizontal rule", () => {
    const md = "# Title\n\nintro\n\n---\n\n## Features\n\nbody"
    const out = truncateReadmeHeroMarkdown(md)
    expect(out).toContain("---")
    expect(out).toContain("## Features")
    expect(out).toContain("body")
  })

  it("limits very long readme by line cap", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`)
    const out = truncateReadmeHeroMarkdown(lines.join("\n"))
    expect(out.split("\n").length).toBeLessThanOrEqual(150)
  })
})

import { describe, expect, it } from "vitest"

import {
  ADDED_TIME_PRESET_DAYS,
  filterByAddedTime,
} from "@/lib/library-project-filters"
import type { Project } from "@/types/project"

function projectWithCreatedAt(createdAt: string): Project {
  return {
    id: 1,
    project_library_id: 1,
    folder_id: null,
    folder_name: null,
    github_url: "https://github.com/o/r",
    name: "demo",
    full_name: "o/r",
    description: null,
    description_translated: null,
    readme_translated: null,
    translation_target_lang: null,
    stars: 0,
    language: null,
    author: null,
    license: null,
    ai_summary: null,
    notes: null,
    deploy_methods: null,
    topics: [],
    forks: 0,
    github_pushed_at: null,
    github_release_tag: null,
    state: "未体验",
    state_changed_at: null,
    created_at: createdAt,
    updated_at: createdAt,
    tags: [],
  }
}

describe("filterByAddedTime", () => {
  const now = new Date("2026-06-27T12:00:00.000Z")

  it("returns all when preset is null", () => {
    const rows = [
      projectWithCreatedAt("2020-01-01T00:00:00.000Z"),
      projectWithCreatedAt("2026-06-26T00:00:00.000Z"),
    ]
    expect(filterByAddedTime(rows, null, now)).toHaveLength(2)
  })

  it("keeps projects created within preset window", () => {
    const rows = [
      projectWithCreatedAt("2026-06-25T00:00:00.000Z"),
      projectWithCreatedAt("2026-06-01T00:00:00.000Z"),
    ]
    const out = filterByAddedTime(rows, "7d", now)
    expect(out).toHaveLength(1)
    expect(out[0]?.created_at).toContain("2026-06-25")
  })

  it("maps preset day counts", () => {
    expect(ADDED_TIME_PRESET_DAYS["30d"]).toBe(30)
  })
})

import { describe, expect, it } from "vitest"

import {
  getDraftTimeBucket,
  groupContentFactoryDraftsByTime,
} from "./group-content-factory-drafts-by-time"
import type { ContentFactoryDraft } from "@/types/content-factory"

function makeDraft(id: number, updatedAt: string): ContentFactoryDraft {
  return {
    id,
    project_library_id: 1,
    project_id: id,
    kind: "single",
    platform: "xiaohongshu",
    step: 1,
    status: "draft",
    title: `草稿 ${id}`,
    body: null,
    body_json: null,
    created_at: updatedAt,
    updated_at: updatedAt,
    project: {
      id,
      name: `project-${id}`,
      full_name: `owner/project-${id}`,
      description: null,
      stars: 0,
      language: null,
    },
  }
}

describe("getDraftTimeBucket", () => {
  const now = new Date(2026, 5, 4, 15, 0, 0)

  it("classifies drafts updated today", () => {
    expect(getDraftTimeBucket("2026-06-04T08:00:00", now)).toBe("today")
  })

  it("classifies drafts updated within 7 days but not today", () => {
    expect(getDraftTimeBucket("2026-06-03T23:59:59", now)).toBe("last7days")
    expect(getDraftTimeBucket("2026-05-29T00:00:00", now)).toBe("last7days")
  })

  it("classifies drafts updated within 30 days but not within 7", () => {
    expect(getDraftTimeBucket("2026-05-27T23:59:59", now)).toBe("last30days")
    expect(getDraftTimeBucket("2026-05-05T00:00:00", now)).toBe("last30days")
  })

  it("classifies older drafts", () => {
    expect(getDraftTimeBucket("2026-05-04T23:59:59", now)).toBe("older")
  })
})

describe("groupContentFactoryDraftsByTime", () => {
  const now = new Date(2026, 5, 4, 12, 0, 0)

  it("groups drafts by bucket and omits empty sections", () => {
    const drafts = [
      makeDraft(1, "2026-06-04T10:00:00"),
      makeDraft(2, "2026-06-02T10:00:00"),
      makeDraft(3, "2026-05-20T10:00:00"),
      makeDraft(4, "2026-04-01T10:00:00"),
    ]

    const groups = groupContentFactoryDraftsByTime(drafts, now)

    expect(groups.map((g) => g.label)).toEqual(["今天", "7 天内", "30 天内", "更早"])
    expect(groups[0]?.drafts.map((d) => d.id)).toEqual([1])
    expect(groups[1]?.drafts.map((d) => d.id)).toEqual([2])
    expect(groups[2]?.drafts.map((d) => d.id)).toEqual([3])
    expect(groups[3]?.drafts.map((d) => d.id)).toEqual([4])
  })
})

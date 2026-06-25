import type { ContentFactoryDraft } from "@/types/content-factory"

export type DraftTimeBucket = "today" | "last7days" | "last30days" | "older"

export type DraftTimeGroup = {
  bucket: DraftTimeBucket
  label: string
  drafts: ContentFactoryDraft[]
}

const BUCKET_ORDER: DraftTimeBucket[] = ["today", "last7days", "last30days", "older"]

const BUCKET_LABELS: Record<DraftTimeBucket, string> = {
  today: "今天",
  last7days: "7 天内",
  last30days: "30 天内",
  older: "更早",
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getDraftTimeBucket(iso: string, now = new Date()): DraftTimeBucket {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return "older"
  }

  const todayStart = startOfLocalDay(now)
  const sevenDaysAgo = new Date(todayStart)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const thirtyDaysAgo = new Date(todayStart)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  if (date >= todayStart) {
    return "today"
  }
  if (date >= sevenDaysAgo) {
    return "last7days"
  }
  if (date >= thirtyDaysAgo) {
    return "last30days"
  }
  return "older"
}

export function groupContentFactoryDraftsByTime(
  drafts: ContentFactoryDraft[],
  now = new Date()
): DraftTimeGroup[] {
  const grouped = new Map<DraftTimeBucket, ContentFactoryDraft[]>()
  for (const bucket of BUCKET_ORDER) {
    grouped.set(bucket, [])
  }

  for (const draft of drafts) {
    const bucket = getDraftTimeBucket(draft.updated_at, now)
    grouped.get(bucket)!.push(draft)
  }

  return BUCKET_ORDER.flatMap((bucket) => {
    const items = grouped.get(bucket) ?? []
    if (items.length === 0) {
      return []
    }
    return [{ bucket, label: BUCKET_LABELS[bucket], drafts: items }]
  })
}

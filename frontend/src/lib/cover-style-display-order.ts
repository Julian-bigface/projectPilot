const COVER_STYLE_PINNED_ORDER_KEY = "project-pilot:cover-style-pinned-order"
export const COVER_STYLE_PINNED_ORDER_EVENT = "cover-style-pinned-order-changed"

export function readPinnedCoverStyleIds(): string[] {
  try {
    const raw = localStorage.getItem(COVER_STYLE_PINNED_ORDER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
  } catch {
    return []
  }
}

function writePinnedCoverStyleIds(ids: string[]): void {
  localStorage.setItem(COVER_STYLE_PINNED_ORDER_KEY, JSON.stringify(ids))
}

export function pinCoverStyleToFront(styleId: string): string[] {
  const trimmed = styleId.trim()
  if (!trimmed) return readPinnedCoverStyleIds()
  const next = [trimmed, ...readPinnedCoverStyleIds().filter((id) => id !== trimmed)]
  writePinnedCoverStyleIds(next)
  return next
}

export function notifyCoverStylePinnedOrderChanged(): void {
  window.dispatchEvent(new Event(COVER_STYLE_PINNED_ORDER_EVENT))
}

export function sortCoverStylesByDisplayOrder<T extends { id: string }>(
  items: T[],
  pinnedIds: string[] = readPinnedCoverStyleIds()
): T[] {
  if (pinnedIds.length === 0) return items
  const rank = new Map(pinnedIds.map((id, index) => [id, index]))
  return [...items].sort((a, b) => {
    const aRank = rank.get(a.id)
    const bRank = rank.get(b.id)
    if (aRank != null && bRank != null) return aRank - bRank
    if (aRank != null) return -1
    if (bRank != null) return 1
    return 0
  })
}

import { useCallback, useEffect, useState } from "react"

import {
  COVER_STYLE_PINNED_ORDER_EVENT,
  notifyCoverStylePinnedOrderChanged,
  pinCoverStyleToFront,
  readPinnedCoverStyleIds,
  sortCoverStylesByDisplayOrder,
} from "@/lib/cover-style-display-order"

export function useCoverStyleDisplayOrder() {
  const [pinnedIds, setPinnedIds] = useState(readPinnedCoverStyleIds)

  useEffect(() => {
    const sync = () => setPinnedIds(readPinnedCoverStyleIds())
    window.addEventListener(COVER_STYLE_PINNED_ORDER_EVENT, sync)
    return () => window.removeEventListener(COVER_STYLE_PINNED_ORDER_EVENT, sync)
  }, [])

  const pinToFront = useCallback((styleId: string) => {
    const next = pinCoverStyleToFront(styleId)
    setPinnedIds(next)
    notifyCoverStylePinnedOrderChanged()
    return next
  }, [])

  const sortByDisplayOrder = useCallback(
    <T extends { id: string }>(items: T[]) => sortCoverStylesByDisplayOrder(items, pinnedIds),
    [pinnedIds]
  )

  return { pinnedIds, pinToFront, sortByDisplayOrder }
}

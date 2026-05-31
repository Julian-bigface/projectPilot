/** 发现频道列表滚动位置（返回预览/详情时恢复） */
const scrollByKey = new Map<string, number>()

const STORAGE_PREFIX = "projectPilot.discoveryListScroll."

export function discoveryListScrollKey(pathname: string, search: string): string {
  return `${pathname}${search}`
}

/** 仅在有有效滚动时写入；scrollTop=0 不覆盖已有记录（避免卸载时误清零） */
export function saveDiscoveryListScroll(key: string, scrollTop: number): void {
  if (scrollTop <= 0) {
    return
  }
  const rounded = Math.round(scrollTop)
  scrollByKey.set(key, rounded)
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, String(rounded))
  } catch {
    /* ignore */
  }
}

export function readDiscoveryListScroll(key: string): number | undefined {
  const mem = scrollByKey.get(key)
  if (mem != null && mem > 0) {
    return mem
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) {
      return undefined
    }
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      scrollByKey.set(key, parsed)
      return parsed
    }
  } catch {
    /* ignore */
  }
  return undefined
}

export function clearDiscoveryListScroll(key: string): void {
  scrollByKey.delete(key)
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    /* ignore */
  }
}

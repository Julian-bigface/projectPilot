import { DISCOVERY_CHANNELS, type DiscoveryChannelId } from "@/types/discovery"

export const DISCOVERY_REFRESH_COOLDOWN_MS = 60 * 60 * 1000

/** 侧栏展示「上次刷新」的频道；主题探索 / 最受欢迎不展示 */
export const DISCOVERY_SIDEBAR_REFRESH_CHANNELS = [
  "trending",
  "hot-release",
] as const satisfies readonly DiscoveryChannelId[]

export function showsDiscoverySidebarRefresh(channelId: DiscoveryChannelId): boolean {
  return (DISCOVERY_SIDEBAR_REFRESH_CHANNELS as readonly DiscoveryChannelId[]).includes(channelId)
}

/** 不在被动加载时写入刷新时间（主题探索由用户搜索驱动，不参与侧栏刷新/被动标记） */
export function marksDiscoveryRefreshOnPassiveLoad(channelId: DiscoveryChannelId): boolean {
  return channelId !== "topic"
}

const LAST_REFRESH_KEY = "projectPilot.discoveryLastRefresh"

export type DiscoveryLastRefreshMap = Partial<Record<DiscoveryChannelId, string>>

export function readDiscoveryLastRefresh(): DiscoveryLastRefreshMap {
  if (typeof window === "undefined") {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(LAST_REFRESH_KEY)
    if (!raw) {
      return {}
    }
    return JSON.parse(raw) as DiscoveryLastRefreshMap
  } catch {
    return {}
  }
}

function writeDiscoveryLastRefresh(map: DiscoveryLastRefreshMap) {
  try {
    window.localStorage.setItem(LAST_REFRESH_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function markDiscoveryChannelRefreshedInStorage(
  channelId: DiscoveryChannelId
): DiscoveryLastRefreshMap {
  const next = { ...readDiscoveryLastRefresh(), [channelId]: new Date().toISOString() }
  writeDiscoveryLastRefresh(next)
  return next
}

export function markAllDiscoveryChannelsRefreshedInStorage(): DiscoveryLastRefreshMap {
  const now = new Date().toISOString()
  const next = Object.fromEntries(DISCOVERY_CHANNELS.map((c) => [c.id, now])) as Record<
    DiscoveryChannelId,
    string
  >
  writeDiscoveryLastRefresh(next)
  return next
}

export function isDiscoveryChannelInRefreshCooldown(
  channelId: DiscoveryChannelId,
  now = Date.now()
): boolean {
  const iso = readDiscoveryLastRefresh()[channelId]
  if (!iso) {
    return false
  }
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) {
    return false
  }
  return now - at < DISCOVERY_REFRESH_COOLDOWN_MS
}

export function shouldUseDiscoveryFreshFetch(
  channelId: DiscoveryChannelId,
  options: { manual: boolean; pendingFresh: boolean }
): boolean {
  if (options.manual) {
    return true
  }
  if (!options.pendingFresh) {
    return false
  }
  return !isDiscoveryChannelInRefreshCooldown(channelId)
}

/** 发现侧栏「上次刷新」：1 小时内「刚刚」；1 小时～1 天按小时；之后按天/周等显示。 */
export function formatDiscoveryRefreshRelative(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "—"
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  const elapsed = Date.now() - date.getTime()
  if (elapsed < DISCOVERY_REFRESH_COOLDOWN_MS) {
    return "刚刚"
  }

  const minute = 60 * 1000
  const fifteenMinutes = 15 * minute
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day

  if (elapsed < hour) {
    const minutes = Math.max(15, Math.floor(elapsed / fifteenMinutes) * 15)
    return `${minutes}分钟前`
  }
  if (elapsed < day) {
    return `${Math.max(1, Math.floor(elapsed / hour))}小时前`
  }
  if (elapsed < week) {
    return `${Math.max(1, Math.floor(elapsed / day))}天前`
  }
  if (elapsed < month) {
    return `${Math.max(1, Math.floor(elapsed / week))}周前`
  }
  if (elapsed < year) {
    return `${Math.max(1, Math.floor(elapsed / month))}个月前`
  }
  return `${Math.max(1, Math.floor(elapsed / year))}年前`
}

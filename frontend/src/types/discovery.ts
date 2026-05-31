export type DiscoveryChannelId =
  | "trending"
  | "hot-release"
  | "most-popular"
  | "topic"

export type TrendingRange = "daily" | "weekly" | "monthly"

export type DiscoveryRepo = {
  rank: number
  full_name: string
  name: string
  github_url: string
  html_url: string
  description: string | null
  stars: number
  forks: number
  language: string | null
  topics: string[]
  owner_login: string | null
  owner_avatar_url: string | null
  pushed_at: string | null
}

export type DiscoveryTopicSearchMeta = {
  mode: "category" | "bilingual" | "plain"
  terms: string[]
  category_name?: string | null
  translated?: string | null
  translation_failed?: boolean
}

export type DiscoveryPage = {
  items: DiscoveryRepo[]
  page: number
  per_page: number
  has_more: boolean
  total_count: number | null
  fetched_at: string
  source: "rss" | "github_search"
  search_meta?: DiscoveryTopicSearchMeta | null
}

export type FetchDiscoveryParams = {
  channelId: DiscoveryChannelId
  page?: number
  perPage?: number
  range?: TrendingRange
  topic?: string
  fresh?: boolean
}

export type DiscoveryEnrichEntry = {
  full_name: string
  rank: number
  name?: string
  html_url?: string
  description?: string | null
  stars?: number
  forks?: number
}

export type DiscoveryEnrichResult = {
  items: DiscoveryRepo[]
  fetched_at: string
}

export const DISCOVERY_CHANNELS: {
  id: DiscoveryChannelId
  label: string
  description: string
}[] = [
  { id: "trending", label: "趋势", description: "GitHub 趋势榜（RSS）" },
  { id: "hot-release", label: "热门发布", description: "近 14 天活跃更新的仓库" },
  { id: "most-popular", label: "最受欢迎", description: "高 Star 稳定热门仓库" },
  { id: "topic", label: "主题探索", description: "按 GitHub Topic 浏览仓库" },
]

export const TRENDING_RANGES: { id: TrendingRange; label: string }[] = [
  { id: "daily", label: "今日" },
  { id: "weekly", label: "本周" },
  { id: "monthly", label: "本月" },
]

export const DEFAULT_TOPIC = "rust"

export function isDiscoveryChannelId(value: string): value is DiscoveryChannelId {
  return DISCOVERY_CHANNELS.some((c) => c.id === value)
}

export function discoveryChannelLabel(id: DiscoveryChannelId): string {
  return DISCOVERY_CHANNELS.find((c) => c.id === id)?.label ?? id
}

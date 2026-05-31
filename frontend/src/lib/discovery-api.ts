import { parseApiErrorMessage } from "@/lib/api-error"
import type {
  DiscoveryChannelId,
  DiscoveryEnrichEntry,
  DiscoveryEnrichResult,
  DiscoveryPage,
  FetchDiscoveryParams,
  TrendingRange,
} from "@/types/discovery"

function channelPath(channelId: DiscoveryChannelId): string {
  switch (channelId) {
    case "trending":
      return "trending"
    case "hot-release":
      return "hot-release"
    case "most-popular":
      return "most-popular"
    case "topic":
      return "topic"
  }
}

export async function fetchDiscoveryPage(params: FetchDiscoveryParams): Promise<DiscoveryPage> {
  const search = new URLSearchParams()
  const page = params.page ?? 1
  const perPage = params.perPage ?? 20
  search.set("page", String(page))
  search.set("per_page", String(perPage))

  if (params.fresh) {
    search.set("fresh", "true")
  }

  if (params.channelId === "trending") {
    search.set("range", params.range ?? "weekly")
  }
  if (params.channelId === "topic" && params.topic?.trim()) {
    search.set("topic", params.topic.trim())
  }

  const path = channelPath(params.channelId)
  const res = await fetch(`/api/discovery/${path}?${search.toString()}`)
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<DiscoveryPage>
}

export async function enrichDiscoveryRepos(items: DiscoveryEnrichEntry[]): Promise<DiscoveryEnrichResult> {
  const res = await fetch("/api/discovery/repos/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<DiscoveryEnrichResult>
}

export function discoveryQueryKey(params: FetchDiscoveryParams) {
  return [
    "discovery",
    params.channelId,
    params.page ?? 1,
    params.perPage ?? 20,
    params.range ?? "weekly",
    params.topic ?? "",
    params.fresh ? "fresh" : "cached",
  ] as const
}

export function parseTrendingRange(value: string | null): TrendingRange {
  if (value === "daily" || value === "weekly" || value === "monthly") {
    return value
  }
  return "weekly"
}

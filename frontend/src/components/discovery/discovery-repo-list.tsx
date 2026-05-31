import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Loader2, ArrowUp } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router"

import { DiscoveryChannelToolbar, discoveryChannelHasToolbar } from "@/components/discovery/discovery-channel-toolbar"
import { DiscoveryRepoCard } from "@/components/discovery/discovery-repo-card"
import { DiscoveryRepoListSkeleton } from "@/components/discovery/discovery-repo-list-skeleton"
import { ImportToLibraryDialog } from "@/components/discovery/import-to-library-dialog"
import { GithubSettingsButton } from "@/components/common/github-settings-link"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDiscoveryHeader } from "@/context/discovery-header"
import { enrichDiscoveryRepos, fetchDiscoveryPage, parseTrendingRange } from "@/lib/discovery-api"
import { formatDiscoveryTopicSearchMeta } from "@/lib/discovery-topic-search-meta"
import { pickDiscoveryRepoDescription } from "@/lib/discovery-display"
import { fetchDiscoveryImportedMap } from "@/lib/discovery-imported-map"
import {
  clearDiscoveryListScroll,
  readDiscoveryListScroll,
  saveDiscoveryListScroll,
} from "@/lib/discovery-list-scroll"
import {
  isDiscoveryChannelInRefreshCooldown,
  marksDiscoveryRefreshOnPassiveLoad,
  shouldUseDiscoveryFreshFetch,
} from "@/lib/discovery-last-refresh"
import { cn } from "@/lib/utils"
import {
  DEFAULT_TOPIC,
  discoveryChannelLabel,
  type DiscoveryChannelId,
  type DiscoveryEnrichEntry,
  type DiscoveryRepo,
} from "@/types/discovery"

export type DiscoveryRepoListProps = {
  channelId: DiscoveryChannelId
  /** 预览叠层时冻结列表 URL（query 参数），避免误读详情页 pathname */
  locationOverride?: { pathname: string; search: string }
  /** 列表被隐藏时暂停无限滚动等副作用 */
  inactive?: boolean
}

const ENRICH_BATCH_SIZE = 5
const BACK_TO_TOP_THRESHOLD_PX = 320

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

function toEnrichEntry(repo: DiscoveryRepo): DiscoveryEnrichEntry {
  return {
    full_name: repo.full_name,
    rank: repo.rank,
    name: repo.name,
    html_url: repo.html_url,
    description: repo.description,
    stars: repo.stars,
    forks: repo.forks,
  }
}

function mergeEnrichedRepo(base: DiscoveryRepo, enriched: DiscoveryRepo): DiscoveryRepo {
  return {
    ...base,
    language: enriched.language ?? base.language,
    topics: enriched.topics?.length ? enriched.topics : base.topics,
    stars: base.stars > 0 ? base.stars : enriched.stars,
    forks: base.forks > 0 ? base.forks : enriched.forks,
    owner_login: enriched.owner_login ?? base.owner_login,
    owner_avatar_url: enriched.owner_avatar_url ?? base.owner_avatar_url,
    pushed_at: enriched.pushed_at ?? base.pushed_at,
    description: pickDiscoveryRepoDescription(base.description, enriched.description),
  }
}

function repoNeedsEnrich(repo: DiscoveryRepo): boolean {
  return repo.stars === 0 || !repo.language?.trim()
}

function enrichKeyFromItems(repos: DiscoveryRepo[]): string {
  return repos.map((repo) => `${repo.full_name}:${repo.rank}`).join("|")
}

export function DiscoveryRepoList({
  channelId,
  locationOverride,
  inactive = false,
}: DiscoveryRepoListProps) {
  const routerLocation = useLocation()
  const listLocation = locationOverride ?? routerLocation
  const scrollKey = `${listLocation.pathname}${listLocation.search}`
  const fromPath = scrollKey
  const listSearch = listLocation.search.startsWith("?")
    ? listLocation.search.slice(1)
    : listLocation.search
  const listSearchParams = useMemo(() => new URLSearchParams(listSearch), [listSearch])
  const range = parseTrendingRange(listSearchParams.get("range"))
  const topic = listSearchParams.get("topic")?.trim() || DEFAULT_TOPIC
  const perPage = 20

  const [importRepo, setImportRepo] = useState<DiscoveryRepo | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const freshRefreshRef = useRef(false)
  const enrichGenerationRef = useRef(0)
  const lastMarkedUpdatedAtRef = useRef(0)
  const skipMarkForPaginationRef = useRef(false)

  const [enrichedByName, setEnrichedByName] = useState<Map<string, DiscoveryRepo>>(() => new Map())
  const [enrichBusy, setEnrichBusy] = useState(false)

  const {
    setHeader,
    refreshRef,
    shouldFreshFetch,
    clearFreshFlag,
    registerActiveRefresh,
    markChannelRefreshed,
  } = useDiscoveryHeader()

  const needsTopic = channelId === "topic"

  const canFetch =
    channelId === "trending" ||
    channelId === "hot-release" ||
    channelId === "most-popular" ||
    (needsTopic && Boolean(topic))

  const baseParams = useMemo(
    () => ({
      channelId,
      perPage,
      range,
      topic: needsTopic ? topic : undefined,
    }),
    [channelId, perPage, range, topic, needsTopic]
  )

  const paramsKey = useMemo(() => JSON.stringify(baseParams), [baseParams])
  const [settledParamsKey, setSettledParamsKey] = useState(paramsKey)

  const query = useInfiniteQuery({
    queryKey: ["discovery", baseParams] as const,
    queryFn: ({ pageParam }) =>
      fetchDiscoveryPage({
        ...baseParams,
        page: pageParam as number,
        fresh: shouldUseDiscoveryFreshFetch(channelId, {
          manual: freshRefreshRef.current,
          pendingFresh: shouldFreshFetch(channelId),
        }),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
    enabled: canFetch,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (shouldFreshFetch(channelId) && isDiscoveryChannelInRefreshCooldown(channelId)) {
      clearFreshFlag(channelId)
    }
  }, [channelId, clearFreshFlag, shouldFreshFetch])

  useEffect(() => {
    lastMarkedUpdatedAtRef.current = 0
    skipMarkForPaginationRef.current = false
  }, [paramsKey, channelId])

  useEffect(() => {
    if (query.isFetchingNextPage) {
      skipMarkForPaginationRef.current = true
    }
  }, [query.isFetchingNextPage])

  useLayoutEffect(() => {
    if (query.isSuccess && !query.isFetching && query.data) {
      setSettledParamsKey(paramsKey)
    }
  }, [query.isSuccess, query.isFetching, query.data, paramsKey])

  const isSwitching = paramsKey !== settledParamsKey
  const showListSkeleton = isSwitching || query.isPending

  /** 被动加载成功后更新侧栏「上次刷新」，使 5 分钟冷却与「刚刚」文案生效 */
  useEffect(() => {
    if (
      inactive ||
      !marksDiscoveryRefreshOnPassiveLoad(channelId) ||
      !query.isSuccess ||
      query.isFetching ||
      showListSkeleton
    ) {
      return
    }
    if (
      channelId === "most-popular" &&
      isDiscoveryChannelInRefreshCooldown(channelId)
    ) {
      return
    }
    if (skipMarkForPaginationRef.current) {
      skipMarkForPaginationRef.current = false
      return
    }
    const updatedAt = query.dataUpdatedAt
    if (updatedAt <= lastMarkedUpdatedAtRef.current) {
      return
    }
    lastMarkedUpdatedAtRef.current = updatedAt
    markChannelRefreshed(channelId)
  }, [
    channelId,
    inactive,
    markChannelRefreshed,
    query.dataUpdatedAt,
    query.isFetching,
    query.isSuccess,
    showListSkeleton,
  ])

  const items = useMemo(() => {
    if (showListSkeleton) return []
    return query.data?.pages.flatMap((p) => p.items) ?? []
  }, [showListSkeleton, query.data])

  const totalCount = showListSkeleton ? null : query.data?.pages[0]?.total_count

  const enrichScopeKey = useMemo(
    () => `${channelId}:${range}:${enrichKeyFromItems(items)}`,
    [channelId, range, items]
  )

  useEffect(() => {
    if (channelId !== "trending" || items.length === 0 || showListSkeleton) {
      enrichGenerationRef.current += 1
      setEnrichedByName(new Map())
      setEnrichBusy(false)
      return
    }

    const generation = enrichGenerationRef.current + 1
    enrichGenerationRef.current = generation
    setEnrichedByName(new Map())
    setEnrichBusy(true)

    const batches = chunk(items, ENRICH_BATCH_SIZE)

    void (async () => {
      try {
        for (const batch of batches) {
          if (enrichGenerationRef.current !== generation) {
            return
          }
          try {
            const result = await enrichDiscoveryRepos(batch.map(toEnrichEntry))
            if (enrichGenerationRef.current !== generation) {
              return
            }
            const byName = new Map(result.items.map((repo) => [repo.full_name, repo]))
            setEnrichedByName((prev) => {
              const next = new Map(prev)
              for (const base of batch) {
                const enriched = byName.get(base.full_name)
                if (enriched) {
                  next.set(base.full_name, mergeEnrichedRepo(base, enriched))
                }
              }
              return next
            })
          } catch {
            /* 单批失败不阻塞其余批次 */
          }
        }
      } finally {
        if (enrichGenerationRef.current === generation) {
          setEnrichBusy(false)
        }
      }
    })()

    return () => {
      enrichGenerationRef.current += 1
    }
  }, [channelId, enrichScopeKey, showListSkeleton])

  const displayItems = useMemo(() => {
    if (channelId !== "trending") {
      return items
    }
    return items.map((repo) => enrichedByName.get(repo.full_name) ?? repo)
  }, [channelId, enrichedByName, items])

  const enrichingTrending = channelId === "trending" && enrichBusy && !showListSkeleton

  const listScrollRef = useRef<HTMLDivElement>(null)
  const listScrollHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScrollTopRef = useRef(0)
  const scrollRestoredRef = useRef(false)
  const scrollingToTopRef = useRef(false)
  const [listScrollbarVisible, setListScrollbarVisible] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)

  const saveScrollNow = useCallback(() => {
    if (inactive) {
      return
    }
    const el = listScrollRef.current
    const top = el?.scrollTop ?? lastScrollTopRef.current
    if (top > 0) {
      lastScrollTopRef.current = top
      saveDiscoveryListScroll(scrollKey, top)
    }
  }, [inactive, scrollKey])

  const scheduleHideListScrollbar = useCallback(() => {
    if (listScrollHideTimerRef.current) {
      clearTimeout(listScrollHideTimerRef.current)
    }
    listScrollHideTimerRef.current = setTimeout(() => {
      listScrollHideTimerRef.current = null
      setListScrollbarVisible(false)
    }, 900)
  }, [])

  const handleListScroll = useCallback(() => {
    setListScrollbarVisible(true)
    scheduleHideListScrollbar()
    const el = listScrollRef.current
    if (!el) {
      return
    }
    lastScrollTopRef.current = el.scrollTop
    if (scrollingToTopRef.current) {
      if (el.scrollTop <= 2) {
        scrollingToTopRef.current = false
        setShowBackToTop(false)
      }
    } else {
      setShowBackToTop(el.scrollTop > BACK_TO_TOP_THRESHOLD_PX)
    }
    if (scrollSaveTimerRef.current) {
      clearTimeout(scrollSaveTimerRef.current)
    }
    scrollSaveTimerRef.current = setTimeout(() => {
      scrollSaveTimerRef.current = null
      saveDiscoveryListScroll(scrollKey, el.scrollTop)
    }, 120)
  }, [scheduleHideListScrollbar, scrollKey])

  const scrollListToTop = useCallback(() => {
    const el = listScrollRef.current
    if (!el) {
      return
    }
    scrollingToTopRef.current = true
    setShowBackToTop(false)
    lastScrollTopRef.current = 0
    clearDiscoveryListScroll(scrollKey)
    el.scrollTo({ top: 0, behavior: "smooth" })
    if (el.scrollTop <= 2) {
      scrollingToTopRef.current = false
      return
    }
    window.setTimeout(() => {
      if (!scrollingToTopRef.current) {
        return
      }
      scrollingToTopRef.current = false
      const top = listScrollRef.current?.scrollTop ?? 0
      setShowBackToTop(top > BACK_TO_TOP_THRESHOLD_PX)
    }, 800)
  }, [scrollKey])

  useEffect(() => {
    if (inactive) {
      return
    }
    const el = listScrollRef.current
    if (el) {
      setShowBackToTop(el.scrollTop > BACK_TO_TOP_THRESHOLD_PX)
    }
  }, [inactive, scrollKey, showListSkeleton])

  useEffect(() => {
    if (inactive) {
      return
    }
    scrollRestoredRef.current = false
    lastScrollTopRef.current = 0
  }, [inactive, scrollKey])

  useEffect(() => {
    return () => {
      if (inactive) {
        return
      }
      if (scrollSaveTimerRef.current) {
        clearTimeout(scrollSaveTimerRef.current)
      }
      saveDiscoveryListScroll(scrollKey, lastScrollTopRef.current)
      if (listScrollHideTimerRef.current) {
        clearTimeout(listScrollHideTimerRef.current)
      }
    }
  }, [inactive, scrollKey])

  useLayoutEffect(() => {
    if (inactive || showListSkeleton || displayItems.length === 0) {
      return
    }
    if (scrollRestoredRef.current) {
      return
    }

    const saved = readDiscoveryListScroll(scrollKey)
    if (saved == null || saved <= 0) {
      scrollRestoredRef.current = true
      return
    }

    const el = listScrollRef.current
    if (!el) {
      return
    }

    let cancelled = false

    const waitFrame = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

    const isRestored = () => Math.abs(el.scrollTop - saved) <= 2

    const tryRestore = async () => {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (cancelled) {
          return
        }

        el.scrollTop = saved
        await waitFrame()
        await waitFrame()

        if (isRestored()) {
          scrollRestoredRef.current = true
          return
        }

        const needsMoreContent = el.scrollHeight < saved + el.clientHeight - 8
        if (needsMoreContent && query.hasNextPage && !query.isFetchingNextPage) {
          await query.fetchNextPage()
          continue
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 50)
        })
      }

      if (!cancelled) {
        el.scrollTop = saved
        if (isRestored()) {
          scrollRestoredRef.current = true
        }
      }
    }

    void tryRestore()

    return () => {
      cancelled = true
    }
  }, [
    displayItems.length,
    enrichingTrending,
    inactive,
    query.fetchNextPage,
    query.hasNextPage,
    query.isFetchingNextPage,
    scrollKey,
    showListSkeleton,
  ])

  useEffect(() => {
    return () => {
      if (listScrollHideTimerRef.current) {
        clearTimeout(listScrollHideTimerRef.current)
      }
    }
  }, [])

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const loadMoreGateRef = useRef({ hasNext: false, fetching: false })
  loadMoreGateRef.current = {
    hasNext: Boolean(query.hasNextPage),
    fetching: query.isFetchingNextPage,
  }

  useEffect(() => {
    const sentinel = loadMoreRef.current
    const scrollRoot = listScrollRef.current
    if (!sentinel || !scrollRoot || showListSkeleton || inactive) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting)
        const { hasNext, fetching } = loadMoreGateRef.current
        if (visible && hasNext && !fetching) {
          void query.fetchNextPage()
        }
      },
      {
        root: scrollRoot,
        rootMargin: "240px 0px",
        threshold: 0,
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    query.fetchNextPage,
    query.hasNextPage,
    showListSkeleton,
    displayItems.length,
    query.isFetchingNextPage,
    inactive,
  ])

  const handleRefresh = useCallback(async () => {
    freshRefreshRef.current = true
    enrichGenerationRef.current += 1
    setEnrichedByName(new Map())
    setEnrichBusy(false)
    scrollRestoredRef.current = true
    clearDiscoveryListScroll(scrollKey)
    lastScrollTopRef.current = 0
    try {
      await query.refetch()
    } finally {
      freshRefreshRef.current = false
      clearFreshFlag(channelId)
    }
    markChannelRefreshed(channelId)
  }, [channelId, clearFreshFlag, markChannelRefreshed, query, scrollKey])

  useEffect(() => {
    registerActiveRefresh(handleRefresh)
    return () => registerActiveRefresh(null)
  }, [handleRefresh, registerActiveRefresh])

  const importedMapQuery = useQuery({
    queryKey: ["discovery-imported-map"],
    queryFn: fetchDiscoveryImportedMap,
    staleTime: 60_000,
  })

  const openImport = (repo: DiscoveryRepo) => {
    setImportRepo(repo)
    setImportOpen(true)
  }

  const headerListBusy = query.isFetching && showListSkeleton
  const headerEnrichBusy = enrichingTrending

  refreshRef.current = () => {
    void handleRefresh()
  }

  const topicSearchMeta = showListSkeleton ? null : query.data?.pages[0]?.search_meta

  const headerMeta = useMemo(() => {
    const parts: string[] = []
    const expansion = channelId === "topic" ? formatDiscoveryTopicSearchMeta(topicSearchMeta) : null
    if (expansion) {
      parts.push(expansion)
    }
    if (totalCount != null) {
      parts.push(`共 ${totalCount.toLocaleString("zh-CN")} 个结果`)
    } else if (showListSkeleton) {
      parts.push("加载中…")
    }
    return parts.length > 0 ? parts.join(" · ") : null
  }, [channelId, showListSkeleton, topicSearchMeta, totalCount])

  useLayoutEffect(() => {
    setHeader({
      title: discoveryChannelLabel(channelId),
      meta: headerMeta,
      enrichBusy: headerEnrichBusy,
      listBusy: headerListBusy,
      fetchBusy: query.isFetching,
    })
    return () => setHeader(null)
  }, [
    channelId,
    headerMeta,
    headerEnrichBusy,
    headerListBusy,
    query.isFetching,
    setHeader,
  ])

  const listBody = () => {
    if (showListSkeleton) {
      return <DiscoveryRepoListSkeleton count={perPage} />
    }

    if (query.isError) {
      const msg = (query.error as Error).message || "加载失败"
      const is424 = msg.includes("Token") || msg.includes("424")
      return (
        <div className="border-border bg-muted/20 rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-destructive text-sm">{msg}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {is424 ? (
              <GithubSettingsButton variant="outline" size="sm">
                配置 GitHub Token
              </GithubSettingsButton>
            ) : (
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                重试
              </Button>
            )}
          </div>
        </div>
      )
    }

    if (displayItems.length === 0) {
      return (
        <div className="border-border bg-muted/20 rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">暂无结果。</p>
        </div>
      )
    }

    return (
      <>
        <ul className="flex flex-col gap-3">
          {displayItems.map((repo) => {
            const cardEnriching = enrichingTrending && repoNeedsEnrich(repo)
            return (
              <li key={`${repo.full_name}-${repo.rank}`}>
                <DiscoveryRepoCard
                  repo={repo}
                  fromPath={fromPath}
                  onBeforeNavigate={saveScrollNow}
                  importedProjectId={importedMapQuery.data?.get(repo.full_name) ?? null}
                  onImport={openImport}
                  enriching={cardEnriching}
                />
              </li>
            )
          })}
        </ul>

        {query.hasNextPage || query.isFetchingNextPage ? (
          <div
            ref={loadMoreRef}
            className="text-muted-foreground mt-6 flex min-h-10 items-center justify-center gap-2 text-sm"
            aria-live="polite"
          >
            {query.isFetchingNextPage ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                加载更多…
              </>
            ) : (
              <span className="sr-only">滚动到底部自动加载更多</span>
            )}
          </div>
        ) : null}
      </>
    )
  }

  return (
    <>
      <ImportToLibraryDialog
        repo={importRepo}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void importedMapQuery.refetch()}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {discoveryChannelHasToolbar(channelId) ? (
          <div className="mb-4 shrink-0">
            <DiscoveryChannelToolbar channelId={channelId} />
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1">
          <div
            ref={listScrollRef}
            className={cn(
              "main-auto-scrollbar h-full min-h-0 overflow-y-auto overscroll-contain",
              listScrollbarVisible && "main-auto-scrollbar--visible"
            )}
            onScroll={handleListScroll}
          >
            {listBody()}
          </div>

          {!inactive && !showListSkeleton ? (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className={cn(
                    "border-border/60 absolute right-4 bottom-4 z-10 size-10 rounded-full border shadow-md transition-opacity duration-200",
                    showBackToTop
                      ? "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0"
                  )}
                  aria-label="回到顶部"
                  aria-hidden={!showBackToTop}
                  tabIndex={showBackToTop ? 0 : -1}
                  onClick={scrollListToTop}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">回到顶部</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </>
  )
}

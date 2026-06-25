import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, ArrowUp } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router"
import { toast } from "sonner"

import { DiscoveryChannelToolbar, discoveryChannelHasToolbar } from "@/components/discovery/discovery-channel-toolbar"
import { DiscoveryRepoCard } from "@/components/discovery/discovery-repo-card"
import { DiscoveryRepoListSkeleton } from "@/components/discovery/discovery-repo-list-skeleton"
import { GithubSettingsButton } from "@/components/common/github-settings-link"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDiscoveryHeader } from "@/context/discovery-header"
import { enrichDiscoveryRepos, fetchDiscoveryPage, parseTrendingRange } from "@/lib/discovery-api"
import {
  readDiscoveryEnrichCache,
  repoNeedsDiscoveryEnrich,
  writeDiscoveryEnrichCache,
} from "@/lib/discovery-enrich-cache"
import { formatDiscoveryTopicSearchMeta } from "@/lib/discovery-topic-search-meta"
import { pickDiscoveryRepoDescription } from "@/lib/discovery-display"
import { fetchDiscoveryImportedMap } from "@/lib/discovery-imported-map"
import { useDiscoveryCollectDialogs } from "@/hooks/use-discovery-collect-dialogs"
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
import {
  fetchTranslationSettings,
  TRANSLATION_TARGET_LANG_LABELS,
} from "@/lib/settings-translation"
import {
  buildDescriptionTranslateJobs,
  translateDescriptionsBatch,
} from "@/lib/translate-plain-text-batch"
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
  return repoNeedsDiscoveryEnrich(repo)
}

function enrichKeyFromItems(repos: DiscoveryRepo[]): string {
  return repos.map((repo) => `${repo.full_name}:${repo.rank}`).join("|")
}

export function DiscoveryRepoList({
  channelId,
  locationOverride,
  inactive = false,
}: DiscoveryRepoListProps) {
  const queryClient = useQueryClient()
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

  const freshRefreshRef = useRef(false)
  const enrichGenerationRef = useRef(0)
  const lastMarkedUpdatedAtRef = useRef(0)
  const skipMarkForPaginationRef = useRef(false)

  const [enrichedByName, setEnrichedByName] = useState<Map<string, DiscoveryRepo>>(() => new Map())
  const [enrichBusy, setEnrichBusy] = useState(false)

  const [translatedByName, setTranslatedByName] = useState<Map<string, string>>(() => new Map())
  const [translatingFullNames, setTranslatingFullNames] = useState<Set<string>>(() => new Set())
  const [showTranslated, setShowTranslated] = useState(false)
  const [translateBusy, setTranslateBusy] = useState(false)
  const translateGenerationRef = useRef(0)
  const lastIncrementalTranslateKeyRef = useRef<string | null>(null)

  const {
    setHeader,
    refreshRef,
    translateDescriptionsRef,
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
  const hasStableData =
    query.isSuccess && !query.isFetching && query.data != null && query.data.pages.length > 0
  const showListSkeleton = query.isPending || (isSwitching && !hasStableData)

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
  const baselineAt = showListSkeleton ? null : query.data?.pages[0]?.baseline_at
  const showTrendingDelta = channelId === "trending" && baselineAt != null

  const enrichScopeKey = useMemo(
    () => `${channelId}:${range}:${enrichKeyFromItems(items)}`,
    [channelId, range, items]
  )

  useEffect(() => {
    if (channelId !== "trending" || items.length === 0 || showListSkeleton || inactive) {
      enrichGenerationRef.current += 1
      if (channelId !== "trending") {
        setEnrichedByName(new Map())
      }
      setEnrichBusy(false)
      return
    }

    const generation = enrichGenerationRef.current + 1
    enrichGenerationRef.current = generation

    const hydrated = new Map<string, DiscoveryRepo>()
    const pending: DiscoveryRepo[] = []

    for (const repo of items) {
      const cached = readDiscoveryEnrichCache(queryClient, repo.full_name)
      if (cached) {
        const merged = mergeEnrichedRepo(repo, cached)
        hydrated.set(repo.full_name, merged)
        if (!repoNeedsEnrich(merged)) {
          continue
        }
        pending.push(merged)
        continue
      }
      if (repoNeedsEnrich(repo)) {
        pending.push(repo)
      } else {
        hydrated.set(repo.full_name, repo)
        writeDiscoveryEnrichCache(queryClient, repo)
      }
    }

    setEnrichedByName(hydrated)
    setEnrichBusy(pending.length > 0)

    if (pending.length === 0) {
      return
    }

    const batches = chunk(pending, ENRICH_BATCH_SIZE)

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
                  const merged = mergeEnrichedRepo(base, enriched)
                  next.set(base.full_name, merged)
                  writeDiscoveryEnrichCache(queryClient, merged)
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
  }, [channelId, enrichScopeKey, inactive, items, queryClient, showListSkeleton])

  const displayItems = useMemo(() => {
    if (channelId !== "trending") {
      return items
    }
    return items.map((repo) => enrichedByName.get(repo.full_name) ?? repo)
  }, [channelId, enrichedByName, items])

  const displayItemsKey = useMemo(() => enrichKeyFromItems(displayItems), [displayItems])

  const translationSettingsQuery = useQuery({
    queryKey: ["settings", "translation"],
    queryFn: fetchTranslationSettings,
    staleTime: 60_000,
  })

  const descriptionTranslateTargetLabel = useMemo(() => {
    const lang = translationSettingsQuery.data?.target_lang ?? "zh-CN"
    return TRANSLATION_TARGET_LANG_LABELS[lang] ?? lang
  }, [translationSettingsQuery.data?.target_lang])

  const descriptionTranslateAvailable = useMemo(() => {
    return displayItems.some((repo) => Boolean(pickDiscoveryRepoDescription(repo.description)?.trim()))
  }, [displayItems])

  useEffect(() => {
    translateGenerationRef.current += 1
    setTranslatedByName(new Map())
    setTranslatingFullNames(new Set())
    setShowTranslated(false)
    setTranslateBusy(false)
    lastIncrementalTranslateKeyRef.current = null
  }, [paramsKey])

  const markFullNamesTranslating = useCallback((fullNamesBySource: Map<string, string[]>) => {
    setTranslatingFullNames((prev) => {
      const next = new Set(prev)
      for (const names of fullNamesBySource.values()) {
        for (const fullName of names) {
          next.add(fullName)
        }
      }
      return next
    })
  }, [])

  const applySourceTranslation = useCallback(
    (fullNamesBySource: Map<string, string[]>, source: string, translated: string) => {
      const fullNames = fullNamesBySource.get(source) ?? []
      if (fullNames.length === 0) {
        return
      }
      setTranslatedByName((prev) => {
        const next = new Map(prev)
        for (const fullName of fullNames) {
          next.set(fullName, translated)
        }
        return next
      })
      setTranslatingFullNames((prev) => {
        const next = new Set(prev)
        for (const fullName of fullNames) {
          next.delete(fullName)
        }
        return next
      })
    },
    []
  )

  const clearSourceTranslating = useCallback(
    (fullNamesBySource: Map<string, string[]>, source: string) => {
      const fullNames = fullNamesBySource.get(source) ?? []
      if (fullNames.length === 0) {
        return
      }
      setTranslatingFullNames((prev) => {
        const next = new Set(prev)
        for (const fullName of fullNames) {
          next.delete(fullName)
        }
        return next
      })
    },
    []
  )

  const runDescriptionTranslate = useCallback(
    async (options?: { onlyMissing?: boolean }) => {
      const alreadyTranslated = options?.onlyMissing
        ? new Set(translatedByName.keys())
        : new Set<string>()

      const { fullNamesBySource, uniqueSources } = buildDescriptionTranslateJobs(
        displayItems.map((repo) => ({
          fullName: repo.full_name,
          source: pickDiscoveryRepoDescription(repo.description),
        })),
        alreadyTranslated
      )

      if (uniqueSources.length === 0) {
        if (!options?.onlyMissing) {
          setShowTranslated(true)
        }
        return
      }

      let generation = translateGenerationRef.current
      if (!options?.onlyMissing) {
        generation = translateGenerationRef.current + 1
        translateGenerationRef.current = generation
      }

      setShowTranslated(true)
      markFullNamesTranslating(fullNamesBySource)
      setTranslateBusy(true)

      let failedCount = 0

      try {
        await translateDescriptionsBatch(uniqueSources, {
          batchSize: ENRICH_BATCH_SIZE,
          onSourceComplete: (source, translated) => {
            if (translateGenerationRef.current !== generation) {
              return
            }
            applySourceTranslation(fullNamesBySource, source, translated)
          },
          onSourceFailed: (source) => {
            if (translateGenerationRef.current !== generation) {
              return
            }
            failedCount += 1
            clearSourceTranslating(fullNamesBySource, source)
          },
        })

        if (translateGenerationRef.current !== generation) {
          return
        }

        if (failedCount > 0) {
          toast.error(`${failedCount} 条简介翻译失败，已保留原文`)
        }
      } catch (err) {
        if (translateGenerationRef.current !== generation) {
          return
        }
        setTranslatingFullNames(new Set())
        toast.error((err as Error).message || "翻译失败")
      } finally {
        if (translateGenerationRef.current === generation) {
          setTranslateBusy(false)
        }
      }
    },
    [
      applySourceTranslation,
      clearSourceTranslating,
      displayItems,
      markFullNamesTranslating,
      translatedByName,
    ]
  )

  const handleToggleTranslate = useCallback(() => {
    if (showTranslated) {
      if (translateBusy) {
        translateGenerationRef.current += 1
        setTranslatingFullNames(new Set())
        setTranslateBusy(false)
      }
      setShowTranslated(false)
      return
    }
    const allCached = displayItems.every((repo) => {
      const source = pickDiscoveryRepoDescription(repo.description)
      if (!source?.trim()) {
        return true
      }
      return translatedByName.has(repo.full_name)
    })
    if (allCached && translatedByName.size > 0) {
      setShowTranslated(true)
      return
    }
    void runDescriptionTranslate()
  }, [
    displayItems,
    runDescriptionTranslate,
    showTranslated,
    translateBusy,
    translatedByName,
  ])

  useEffect(() => {
    if (inactive || showListSkeleton || !showTranslated) {
      return
    }
    if (lastIncrementalTranslateKeyRef.current === displayItemsKey) {
      return
    }

    const hasMissing = displayItems.some((repo) => {
      const source = pickDiscoveryRepoDescription(repo.description)
      return (
        Boolean(source?.trim()) &&
        !translatedByName.has(repo.full_name) &&
        !translatingFullNames.has(repo.full_name)
      )
    })

    if (!hasMissing) {
      lastIncrementalTranslateKeyRef.current = displayItemsKey
      return
    }

    lastIncrementalTranslateKeyRef.current = displayItemsKey
    void runDescriptionTranslate({ onlyMissing: true })
  }, [
    displayItems,
    displayItemsKey,
    inactive,
    runDescriptionTranslate,
    showListSkeleton,
    showTranslated,
    translatedByName,
    translatingFullNames,
  ])

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
    translateGenerationRef.current += 1
    setEnrichedByName(new Map())
    setEnrichBusy(false)
    setTranslatedByName(new Map())
    setTranslatingFullNames(new Set())
    setShowTranslated(false)
    setTranslateBusy(false)
    lastIncrementalTranslateKeyRef.current = null
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

  const { requestCollect, requestUncollect, dialogs, uncollectingProjectId } =
    useDiscoveryCollectDialogs()

  const headerListBusy = query.isFetching && showListSkeleton
  const headerEnrichBusy = enrichingTrending

  refreshRef.current = () => {
    void handleRefresh()
  }

  translateDescriptionsRef.current = () => {
    handleToggleTranslate()
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
      descriptionTranslateBusy: translateBusy,
      descriptionTranslateActive: showTranslated,
      descriptionTranslateTargetLabel,
      descriptionTranslateAvailable,
    })
    return () => setHeader(null)
  }, [
    channelId,
    descriptionTranslateAvailable,
    descriptionTranslateTargetLabel,
    headerMeta,
    headerEnrichBusy,
    headerListBusy,
    query.isFetching,
    setHeader,
    showTranslated,
    translateBusy,
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
            const sourceDescription = pickDiscoveryRepoDescription(repo.description)
            const hasSource = Boolean(sourceDescription?.trim())
            const translatedDescription = showTranslated
              ? translatedByName.get(repo.full_name)
              : undefined
            const descriptionTranslating =
              showTranslated &&
              hasSource &&
              !translatedByName.has(repo.full_name) &&
              translatingFullNames.has(repo.full_name)
            return (
              <li key={`${repo.full_name}-${repo.rank}`}>
                <DiscoveryRepoCard
                  repo={repo}
                  fromPath={fromPath}
                  onBeforeNavigate={saveScrollNow}
                  importedProjectId={importedMapQuery.data?.get(repo.full_name) ?? null}
                  onCollect={requestCollect}
                  onUncollect={requestUncollect}
                  uncollecting={
                    uncollectingProjectId != null &&
                    uncollectingProjectId === importedMapQuery.data?.get(repo.full_name)
                  }
                  enriching={cardEnriching}
                  showDelta={showTrendingDelta}
                  descriptionOverride={
                    showTranslated && translatedDescription ? translatedDescription : undefined
                  }
                  descriptionTranslating={descriptionTranslating}
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
      {dialogs}
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

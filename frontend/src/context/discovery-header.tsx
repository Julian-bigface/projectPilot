import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"

import { DISCOVERY_CHANNELS, type DiscoveryChannelId } from "@/types/discovery"
import {
  markAllDiscoveryChannelsRefreshedInStorage,
  markDiscoveryChannelRefreshedInStorage,
  readDiscoveryLastRefresh,
  type DiscoveryLastRefreshMap,
} from "@/lib/discovery-last-refresh"

export type DiscoveryHeaderState = {
  title: string
  meta: string | null
  enrichBusy: boolean
  listBusy: boolean
  fetchBusy: boolean
  descriptionTranslateBusy: boolean
  descriptionTranslateActive: boolean
  /** 翻译目标语言展示名，如「简体中文」 */
  descriptionTranslateTargetLabel: string | null
  /** 当前列表是否有可译简介 */
  descriptionTranslateAvailable: boolean
}

type DiscoveryHeaderContextValue = {
  header: DiscoveryHeaderState | null
  setHeader: (header: DiscoveryHeaderState | null) => void
  refreshRef: React.MutableRefObject<(() => void) | null>
  translateDescriptionsRef: React.MutableRefObject<(() => void) | null>
  shouldFreshFetch: (channelId: DiscoveryChannelId) => boolean
  markChannelFresh: (channelId: DiscoveryChannelId) => void
  markAllChannelsFresh: () => void
  clearFreshFlag: (channelId: DiscoveryChannelId) => void
  registerActiveRefresh: (fn: (() => Promise<void>) | null) => void
  refreshCurrentChannel: () => Promise<void>
  refreshAllChannels: () => Promise<void>
  lastRefresh: DiscoveryLastRefreshMap
  markChannelRefreshed: (channelId: DiscoveryChannelId) => void
  markAllChannelsRefreshed: () => void
}

const DiscoveryHeaderContext = createContext<DiscoveryHeaderContextValue | null>(null)

export function DiscoveryHeaderProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [header, setHeaderState] = useState<DiscoveryHeaderState | null>(null)
  const [lastRefresh, setLastRefresh] = useState<DiscoveryLastRefreshMap>(() => readDiscoveryLastRefresh())
  const refreshRef = useRef<(() => void) | null>(null)
  const translateDescriptionsRef = useRef<(() => void) | null>(null)
  const pendingFreshChannelsRef = useRef(new Set<DiscoveryChannelId>())
  const activeRefreshRef = useRef<(() => Promise<void>) | null>(null)

  const setHeader = useCallback((next: DiscoveryHeaderState | null) => {
    setHeaderState(next)
  }, [])

  const shouldFreshFetch = useCallback((channelId: DiscoveryChannelId) => {
    return pendingFreshChannelsRef.current.has(channelId)
  }, [])

  const markChannelFresh = useCallback((channelId: DiscoveryChannelId) => {
    pendingFreshChannelsRef.current.add(channelId)
  }, [])

  const markAllChannelsFresh = useCallback(() => {
    for (const channel of DISCOVERY_CHANNELS) {
      pendingFreshChannelsRef.current.add(channel.id)
    }
  }, [])

  const clearFreshFlag = useCallback((channelId: DiscoveryChannelId) => {
    pendingFreshChannelsRef.current.delete(channelId)
  }, [])

  const registerActiveRefresh = useCallback((fn: (() => Promise<void>) | null) => {
    activeRefreshRef.current = fn
  }, [])

  const refreshCurrentChannel = useCallback(async () => {
    if (activeRefreshRef.current) {
      await activeRefreshRef.current()
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["discovery"] })
  }, [queryClient])

  const refreshAllChannels = useCallback(async () => {
    markAllChannelsFresh()
    if (activeRefreshRef.current) {
      await activeRefreshRef.current()
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["discovery"] })
  }, [markAllChannelsFresh, queryClient])

  const markChannelRefreshed = useCallback((channelId: DiscoveryChannelId) => {
    setLastRefresh(markDiscoveryChannelRefreshedInStorage(channelId))
  }, [])

  const markAllChannelsRefreshed = useCallback(() => {
    setLastRefresh(markAllDiscoveryChannelsRefreshedInStorage())
  }, [])

  const value = useMemo(
    () => ({
      header,
      setHeader,
      refreshRef,
      translateDescriptionsRef,
      shouldFreshFetch,
      markChannelFresh,
      markAllChannelsFresh,
      clearFreshFlag,
      registerActiveRefresh,
      refreshCurrentChannel,
      refreshAllChannels,
      lastRefresh,
      markChannelRefreshed,
      markAllChannelsRefreshed,
    }),
    [
      header,
      setHeader,
      shouldFreshFetch,
      markChannelFresh,
      markAllChannelsFresh,
      clearFreshFlag,
      registerActiveRefresh,
      refreshCurrentChannel,
      refreshAllChannels,
      lastRefresh,
      markChannelRefreshed,
      markAllChannelsRefreshed,
    ]
  )

  return <DiscoveryHeaderContext.Provider value={value}>{children}</DiscoveryHeaderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook must live next to context
export function useDiscoveryHeader(): DiscoveryHeaderContextValue {
  const ctx = useContext(DiscoveryHeaderContext)
  if (!ctx) {
    throw new Error("useDiscoveryHeader must be used within DiscoveryHeaderProvider")
  }
  return ctx
}

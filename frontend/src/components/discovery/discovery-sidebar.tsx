import { RefreshCw, Rocket, Tag, TrendingUp, Trophy } from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink, useLocation } from "react-router"

import { GithubSettingsButton } from "@/components/common/github-settings-link"
import { Button } from "@/components/ui/button"
import { useDiscoveryHeader } from "@/context/discovery-header"
import { formatDiscoveryRefreshRelative, showsDiscoverySidebarRefresh } from "@/lib/discovery-last-refresh"
import { cn } from "@/lib/utils"
import { DISCOVERY_CHANNELS, type DiscoveryChannelId } from "@/types/discovery"

const CHANNEL_ICONS: Record<DiscoveryChannelId, typeof TrendingUp> = {
  trending: TrendingUp,
  "hot-release": Rocket,
  "most-popular": Trophy,
  topic: Tag,
}

export function DiscoverySidebar() {
  const location = useLocation()
  const {
    refreshAllChannels,
    refreshCurrentChannel,
    lastRefresh,
    markAllChannelsRefreshed,
    markChannelRefreshed,
  } = useDiscoveryHeader()
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [, timeTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => timeTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const refreshAll = () => {
    setRefreshingAll(true)
    void refreshAllChannels()
      .then(() => {
        markAllChannelsRefreshed()
      })
      .finally(() => {
        setRefreshingAll(false)
      })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">发现频道</h2>
          <p className="text-muted-foreground text-xs">探索 GitHub 热门仓库</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          title="刷新全部频道"
          aria-label="刷新全部频道"
          disabled={refreshingAll}
          onClick={refreshAll}
        >
          <RefreshCw className={cn("size-4", refreshingAll && "animate-spin")} aria-hidden />
        </Button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="发现频道">
        {DISCOVERY_CHANNELS.map((channel) => {
          const Icon = CHANNEL_ICONS[channel.id]
          const href = `/discovery/${channel.id}`
          const refreshedAt = showsDiscoverySidebarRefresh(channel.id)
            ? lastRefresh[channel.id]
            : undefined
          return (
            <NavLink
              key={channel.id}
              to={href}
              className={({ isActive }) =>
                cn(
                  "hover:bg-accent flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  isActive && "bg-accent font-medium"
                )
              }
              onClick={(e) => {
                if (location.pathname === href) {
                  e.preventDefault()
                  void refreshCurrentChannel().then(() => {
                    markChannelRefreshed(channel.id)
                  })
                }
              }}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="truncate">{channel.label}</span>
              </span>
              {refreshedAt ? (
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {formatDiscoveryRefreshRelative(refreshedAt)}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-border border-t p-3">
        <GithubSettingsButton type="button" variant="outline" size="sm" className="w-full text-xs">
          GitHub Token 设置
        </GithubSettingsButton>
      </div>
    </div>
  )
}

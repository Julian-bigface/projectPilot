import { Navigate, Outlet, useLocation } from "react-router"
import { useRef } from "react"

import { DiscoveryRepoList } from "@/components/discovery/discovery-repo-list"
import { DiscoveryRepoDetailPage } from "@/pages/discovery/repo-detail"
import { isDiscoveryChannelId, type DiscoveryChannelId } from "@/types/discovery"
import { cn } from "@/lib/utils"

function isDiscoveryRepoDetailPath(pathname: string): boolean {
  return /^\/discovery\/r\/[^/]+\/[^/]+$/.test(pathname)
}

function parseChannelIdFromPathname(pathname: string): DiscoveryChannelId | null {
  const match = pathname.match(/^\/discovery\/([^/]+)$/)
  if (match && isDiscoveryChannelId(match[1])) {
    return match[1] as DiscoveryChannelId
  }
  return null
}

function splitDiscoveryPath(path: string): { pathname: string; search: string } {
  const qIndex = path.indexOf("?")
  if (qIndex === -1) {
    return { pathname: path, search: "" }
  }
  return { pathname: path.slice(0, qIndex), search: path.slice(qIndex) }
}

function parseListPathFromState(from: unknown): { pathname: string; search: string } | null {
  if (typeof from !== "string" || !from.startsWith("/discovery")) {
    return null
  }
  return splitDiscoveryPath(from)
}

/** 占位：实际内容由 DiscoveryLayout 按 pathname 渲染 */
export function DiscoveryRoutePlaceholder() {
  return null
}

/** 发现区布局：预览页叠层时保持列表挂载以保留滚动位置 */
export function DiscoveryLayout() {
  const location = useLocation()
  const pathname = location.pathname
  const isDetail = isDiscoveryRepoDetailPath(pathname)
  const channelFromUrl = parseChannelIdFromPathname(pathname)

  const lastChannelRef = useRef<DiscoveryChannelId>("trending")
  const lastListPathRef = useRef<{ pathname: string; search: string }>({
    pathname: "/discovery/trending",
    search: "",
  })

  if (channelFromUrl) {
    lastChannelRef.current = channelFromUrl
    lastListPathRef.current = { pathname, search: location.search }
  }

  const detailListPath = parseListPathFromState(location.state?.from)
  if (isDetail && detailListPath) {
    const channelFromState = parseChannelIdFromPathname(detailListPath.pathname)
    if (channelFromState) {
      lastChannelRef.current = channelFromState
    }
    lastListPathRef.current = detailListPath
  }

  if (pathname === "/discovery" || pathname === "/discovery/") {
    return <Outlet />
  }

  if (pathname === "/discovery/search") {
    const params = new URLSearchParams(location.search)
    const legacyQ = params.get("q")?.trim()
    if (legacyQ) {
      params.delete("q")
      params.set("topic", legacyQ)
      const nextSearch = params.toString()
      return (
        <Navigate
          to={nextSearch ? `/discovery/topic?${nextSearch}` : "/discovery/topic"}
          replace
        />
      )
    }
    return <Navigate to="/discovery/topic" replace />
  }

  if (!isDetail && channelFromUrl == null) {
    return <Navigate to="/discovery/trending" replace />
  }

  const listChannelId = lastChannelRef.current
  const listLocation = lastListPathRef.current

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn("flex min-h-0 flex-1 flex-col", isDetail && "hidden")}
        aria-hidden={isDetail || undefined}
      >
        <DiscoveryRepoList
          channelId={listChannelId}
          locationOverride={isDetail ? listLocation : undefined}
          inactive={isDetail}
        />
      </div>
      {isDetail ? <DiscoveryRepoDetailPage /> : null}
    </div>
  )
}

export function DiscoveryIndexRedirect() {
  return <Navigate to="trending" replace />
}

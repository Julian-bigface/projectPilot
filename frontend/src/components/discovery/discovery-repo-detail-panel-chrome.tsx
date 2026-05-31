import { ChevronLeft } from "lucide-react"
import { Link, useLocation, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import {
  discoveryChannelLabel,
  isDiscoveryChannelId,
  type DiscoveryChannelId,
} from "@/types/discovery"

const DEFAULT_BACK = "/discovery/trending"

function resolveBackPath(from: unknown): string {
  if (typeof from === "string" && from.startsWith("/discovery")) {
    return from
  }
  return DEFAULT_BACK
}

function resolveSubtitle(from: unknown, repoName: string | undefined): string {
  if (typeof from === "string") {
    const match = from.match(/^\/discovery\/([^/?]+)/)
    if (match && isDiscoveryChannelId(match[1])) {
      return `${discoveryChannelLabel(match[1] as DiscoveryChannelId)} · ${repoName ?? "仓库预览"}`
    }
  }
  return repoName ?? "仓库预览"
}

export function DiscoveryRepoDetailPanelChrome() {
  const location = useLocation()
  const { repo: repoParam } = useParams<{ owner: string; repo: string }>()
  const backTo = resolveBackPath(location.state?.from)
  const subtitle = resolveSubtitle(location.state?.from, repoParam)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
        asChild
      >
        <Link to={backTo} aria-label="返回发现">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </Button>
      <span className="text-foreground min-w-0 truncate text-sm font-medium">{subtitle}</span>
    </div>
  )
}

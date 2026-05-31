import { ChevronLeft } from "lucide-react"
import { Link, useLocation } from "react-router"

import { Button } from "@/components/ui/button"
import { readLastProjectLibraryId } from "@/context/project-library"

export function ProjectDetailPanelChrome() {
  const location = useLocation()
  const fromDiscovery =
    typeof location.state?.from === "string" && location.state.from.startsWith("/discovery")
  const lastId = readLastProjectLibraryId()
  const backTo = fromDiscovery
    ? location.state.from
    : lastId != null
      ? `/libraries/${lastId}`
      : "/libraries"
  const label = fromDiscovery ? "发现" : "资料库"

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
        asChild
      >
        <Link to={backTo} aria-label={fromDiscovery ? "返回发现" : "返回资料库"}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </Button>
      <span className="text-foreground min-w-0 truncate text-sm font-medium">{label}</span>
    </div>
  )
}

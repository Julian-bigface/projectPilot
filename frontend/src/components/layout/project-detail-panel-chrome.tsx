import { ChevronLeft } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"

export function ProjectDetailPanelChrome() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
        asChild
      >
        <Link to="/library" aria-label="返回资料库">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </Button>
      <span className="text-foreground min-w-0 truncate text-sm font-medium">资料库</span>
    </div>
  )
}

import { BookMarked, LayoutGrid, Library, List, MoreHorizontal } from "lucide-react"
import { Link, NavLink, useLocation } from "react-router"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const railBtn =
  "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-md transition-colors [&.active]:bg-accent [&.active]:text-accent-foreground"

export function FunctionRail() {
  const { pathname } = useLocation()
  const settingsActive = pathname.startsWith("/settings")

  return (
    <aside
      className="border-border bg-muted/20 flex h-full min-h-0 w-[52px] shrink-0 flex-col items-center gap-1 border-r py-2"
      aria-label="功能区"
    >
      <div className="border-border bg-background mb-1 flex size-9 shrink-0 items-center justify-center rounded-md border text-xs font-semibold shadow-sm">
        PP
      </div>

      <NavLink to="/library" end className={({ isActive }) => cn(railBtn, isActive && "active")} title="资料库">
        <Library className="size-[18px]" aria-hidden />
      </NavLink>
      <NavLink to="/projects" end className={({ isActive }) => cn(railBtn, isActive && "active")} title="项目列表">
        <List className="size-[18px]" aria-hidden />
      </NavLink>
      <NavLink to="/projects/board" className={({ isActive }) => cn(railBtn, isActive && "active")} title="看板">
        <LayoutGrid className="size-[18px]" aria-hidden />
      </NavLink>
      <NavLink
        to="/projects/mock-shelf"
        className={({ isActive }) => cn(railBtn, isActive && "active")}
        title="模拟书架"
      >
        <BookMarked className="size-[18px]" aria-hidden />
      </NavLink>

      <div className="flex min-h-0 flex-1 flex-col justify-end pb-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(railBtn, settingsActive && "active")}
              aria-label="更多"
              title="更多"
            >
              <MoreHorizontal className="size-[18px]" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="min-w-[9rem]">
            <DropdownMenuItem asChild>
              <Link to="/settings">设置</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

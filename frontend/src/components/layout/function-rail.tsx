import { Factory, LayoutGrid, Library, TrendingUp } from "lucide-react"
import { NavLink, useLocation } from "react-router"

import { RailUserMenu } from "@/components/layout/rail-user-menu"
import { contentFactoryEntryHref } from "@/lib/content-factory-path"
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

      <NavLink
        to="/libraries"
        className={({ isActive }) =>
          cn(railBtn, (isActive || pathname.startsWith("/libraries")) && "active")
        }
        title="项目库"
      >
        <Library className="size-[18px]" aria-hidden />
      </NavLink>
      <NavLink
        to="/discovery"
        className={({ isActive }) =>
          cn(railBtn, (isActive || pathname.startsWith("/discovery")) && "active")
        }
        title="发现"
      >
        <TrendingUp className="size-[18px]" aria-hidden />
      </NavLink>
      <NavLink
        to={contentFactoryEntryHref()}
        className={({ isActive }) =>
          cn(railBtn, (isActive || pathname.includes("/content-factory")) && "active")
        }
        title="内容工厂"
      >
        <Factory className="size-[18px]" aria-hidden />
      </NavLink>
      <NavLink to="/projects/board" className={({ isActive }) => cn(railBtn, isActive && "active")} title="看板">
        <LayoutGrid className="size-[18px]" aria-hidden />
      </NavLink>

      <div className="mt-auto flex w-full shrink-0 flex-col px-1 pb-1">
        <RailUserMenu settingsActive={settingsActive} />
      </div>
    </aside>
  )
}

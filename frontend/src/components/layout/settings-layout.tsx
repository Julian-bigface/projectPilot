import { ArrowLeft } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router"

import { FunctionRail } from "@/components/layout/function-rail"
import { cn } from "@/lib/utils"

const navItem =
  "text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2.5 text-sm transition-colors [&.active]:bg-accent [&.active]:text-accent-foreground [&.active]:font-medium"

export function SettingsLayout() {
  return (
    <div className="bg-background flex h-svh min-h-0 w-full">
      <FunctionRail />
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside
          className="border-border bg-muted/15 flex w-56 shrink-0 flex-col border-r"
          aria-label="设置导航"
        >
          <div className="border-border shrink-0 border-b px-4 py-4">
            <Link
              to="/library"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              返回资料库
            </Link>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            <NavLink to="/settings" end className={({ isActive }) => cn(navItem, isActive && "active")}>
              通用设置
            </NavLink>
            <NavLink to="/settings/github" className={({ isActive }) => cn(navItem, isActive && "active")}>
              GitHub
            </NavLink>
          </nav>
        </aside>
        <main className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl px-8 py-12 md:px-12 md:py-16">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

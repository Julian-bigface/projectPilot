import { ArrowLeft } from "lucide-react"
import { useEffect, useRef } from "react"
import { Link, NavLink, useLocation, useNavigate } from "react-router"

import { FunctionRail } from "@/components/layout/function-rail"
import { useGithubSettingsDialog } from "@/context/github-settings-dialog"
import { useSettingsScrollSpy } from "@/hooks/use-settings-scroll-spy"
import { readLastProjectLibraryId } from "@/context/project-library"
import {
  isSettingsAiPath,
  isSettingsScrollSectionId,
  SETTINGS_AI_ROUTE,
  SETTINGS_SCROLL_SECTIONS,
} from "@/lib/settings-sections"
import { cn } from "@/lib/utils"
import { AiSettingsPage } from "@/pages/ai-settings"
import { SettingsPage } from "@/pages/settings"

const navItem =
  "text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors"

export function SettingsLayout() {
  const lastId = readLastProjectLibraryId()
  const backTo = lastId != null ? `/libraries/${lastId}` : "/libraries"
  const scrollRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { openDialog } = useGithubSettingsDialog()
  const isAiPage = isSettingsAiPath(pathname)
  const { activeId, scrollToSection } = useSettingsScrollSpy(scrollRef, { enabled: !isAiPage })

  useEffect(() => {
    const legacySection = pathname.replace(/^\/settings\/?/, "")
    if (legacySection === "github") {
      openDialog()
      navigate({ pathname: "/settings" }, { replace: true })
      return
    }
    if (legacySection === "ai") {
      navigate({ pathname: SETTINGS_AI_ROUTE.path }, { replace: true })
      return
    }
    if (isSettingsScrollSectionId(legacySection)) {
      navigate({ pathname: "/settings", hash: legacySection }, { replace: true })
    }
  }, [navigate, openDialog, pathname])

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
              to={backTo}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              返回资料库
            </Link>
          </div>
          <nav className="flex flex-col gap-1 p-3" aria-label="设置分区">
            {SETTINGS_SCROLL_SECTIONS.map((section) =>
              isAiPage ? (
                <Link
                  key={section.id}
                  to={`/settings#${section.id}`}
                  className={navItem}
                >
                  {section.label}
                </Link>
              ) : (
                <button
                  key={section.id}
                  type="button"
                  className={cn(
                    navItem,
                    activeId === section.id && "bg-accent text-accent-foreground font-medium"
                  )}
                  aria-current={activeId === section.id ? "true" : undefined}
                  onClick={() => scrollToSection(section.id)}
                >
                  {section.label}
                </button>
              )
            )}
            <NavLink
              to={SETTINGS_AI_ROUTE.path}
              className={({ isActive }) =>
                cn(
                  navItem,
                  (isActive || isAiPage) && "bg-accent text-accent-foreground font-medium"
                )
              }
              aria-current={isAiPage ? "page" : undefined}
            >
              {SETTINGS_AI_ROUTE.label}
            </NavLink>
          </nav>
        </aside>
        <main ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-8 py-10 md:px-12 md:py-14">
            {isAiPage ? <AiSettingsPage /> : <SettingsPage />}
          </div>
        </main>
      </div>
    </div>
  )
}

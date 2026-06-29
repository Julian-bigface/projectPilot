import { Sparkles } from "lucide-react"
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router"

import { AiConfigDraftProvider } from "@/context/ai-config-draft"
import { AI_STUDIO_NAV, AI_STUDIO_ROUTES } from "@/lib/ai-studio-routes"
import { cn } from "@/lib/utils"
import { AiCapabilitiesPage } from "@/pages/ai-settings/capabilities"
import { AiOverviewPage } from "@/pages/ai-settings/overview"
import { AiProviderDetailPage } from "@/pages/ai-settings/providers/detail"
import { AiProvidersPage } from "@/pages/ai-settings/providers/index"

const navTabClass =
  "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors"

function AiStudioShell() {
  const { pathname } = useLocation()
  const isProviderDetail = /^\/settings\/ai\/providers\/[^/]+$/.test(pathname)

  return (
    <div className="space-y-6 pb-16">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">AI 工作室</h1>
            </div>
          </div>
        </div>

        {!isProviderDetail ? (
          <nav
            className="border-border mt-6 flex flex-wrap gap-1 border-b pb-px"
            aria-label="AI 工作室导航"
          >
            {AI_STUDIO_NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.id === "overview"}
                className={({ isActive }) =>
                  cn(
                    navTabClass,
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>

      <Routes>
        <Route index element={<AiOverviewPage />} />
        <Route path="providers" element={<AiProvidersPage />} />
        <Route path="providers/:id" element={<AiProviderDetailPage />} />
        <Route path="capabilities" element={<AiCapabilitiesPage />} />
        <Route path="*" element={<Navigate to={AI_STUDIO_ROUTES.overview} replace />} />
      </Routes>
    </div>
  )
}

export function AiStudioLayout() {
  return (
    <AiConfigDraftProvider>
      <AiStudioShell />
    </AiConfigDraftProvider>
  )
}

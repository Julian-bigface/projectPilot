import { ThemeCycleButton } from "@/components/common/theme-cycle-button"
import { WelcomeCarousel } from "@/components/welcome/welcome-carousel"
import { WelcomePatPanel } from "@/components/welcome/welcome-pat-panel"

export function WelcomePage() {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="border-border bg-background flex size-9 shrink-0 items-center justify-center rounded-md border text-xs font-semibold shadow-sm">
            PP
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Project Pilot</p>
            <p className="text-muted-foreground mt-1 text-xs">GitHub 开源项目探索管理</p>
          </div>
        </div>

        <ThemeCycleButton />
      </header>

      <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section
          className="border-border relative flex min-h-[360px] flex-col lg:min-h-0 lg:border-r"
          aria-label="产品介绍"
        >
          <WelcomeCarousel />
        </section>
        <section className="bg-muted/20 flex min-h-0 flex-col" aria-label="GitHub 连接">
          <WelcomePatPanel />
        </section>
      </main>
    </div>
  )
}

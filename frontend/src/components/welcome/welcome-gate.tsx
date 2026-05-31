import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"

import { WelcomePage } from "@/pages/welcome/welcome-page"
import { fetchGithubSettings } from "@/lib/settings-github"

type WelcomeGateProps = {
  children: ReactNode
}

function WelcomeLoading() {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center">
      <div className="text-muted-foreground flex flex-col items-center gap-3 text-sm">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <p>正在加载…</p>
      </div>
    </div>
  )
}

export function WelcomeGate({ children }: WelcomeGateProps) {
  const settingsQuery = useQuery({
    queryKey: ["settings", "github"],
    queryFn: fetchGithubSettings,
    staleTime: 30_000,
    retry: 2,
  })

  if (settingsQuery.isLoading) {
    return <WelcomeLoading />
  }

  if (settingsQuery.isError) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-destructive text-sm leading-relaxed">
            {settingsQuery.error instanceof Error
              ? settingsQuery.error.message
              : "无法连接后端，请确认 API 已启动。"}
          </p>
        </div>
      </div>
    )
  }

  if (!settingsQuery.data?.has_token) {
    return <WelcomePage />
  }

  return <>{children}</>
}

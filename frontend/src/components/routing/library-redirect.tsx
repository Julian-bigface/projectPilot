import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Navigate } from "react-router"

import { resolveAppHomePath } from "@/lib/app-home"

/** 根路径与旧 `/library`：进入上次项目库，若无记录则进入项目库目录页。 */
export function LibraryRedirect() {
  const homeQuery = useQuery({
    queryKey: ["app-home"],
    queryFn: resolveAppHomePath,
    staleTime: 0,
    retry: 1,
  })

  if (homeQuery.isLoading) {
    return (
      <div className="text-muted-foreground flex min-h-0 min-w-0 flex-1 items-center justify-center gap-2 p-8 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        正在进入…
      </div>
    )
  }

  return <Navigate to={homeQuery.data ?? "/libraries"} replace />
}

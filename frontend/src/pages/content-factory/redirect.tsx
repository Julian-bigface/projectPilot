import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Navigate } from "react-router"

import { resolveContentFactoryPath } from "@/lib/content-factory-path"

/** /content-factory → 解析项目库后进入项目推广 */
export function ContentFactoryRedirect() {
  const pathQuery = useQuery({
    queryKey: ["content-factory", "entry-path"],
    queryFn: resolveContentFactoryPath,
    staleTime: 0,
    retry: 1,
  })

  if (pathQuery.isLoading) {
    return (
      <div className="text-muted-foreground flex min-h-0 min-w-0 flex-1 items-center justify-center gap-2 p-8 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        正在进入内容工厂…
      </div>
    )
  }

  return <Navigate to={pathQuery.data ?? "/libraries"} replace />
}

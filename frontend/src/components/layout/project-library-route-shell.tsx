import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { Navigate, useParams } from "react-router"

import {
  ProjectLibraryProvider,
  writeLastProjectLibraryId,
} from "@/context/project-library"
import type { ProjectLibrary } from "@/types/project-library"

async function fetchProjectLibrary(id: number): Promise<ProjectLibrary> {
  const res = await fetch(`/api/project-libraries/${id}`)
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`)
  }
  return res.json() as Promise<ProjectLibrary>
}

/**
 * 在 AppLayout 层提供项目库上下文，使侧栏与主区 Outlet 共用同一 libraryId。
 */
export function ProjectLibraryRouteShell({ children }: { children: ReactNode }) {
  const { libraryId: libraryIdParam } = useParams()
  const libraryId = Number(libraryIdParam)
  const libraryIdValid = Number.isFinite(libraryId) && libraryId > 0

  const query = useQuery({
    queryKey: ["project-libraries", libraryId],
    queryFn: () => fetchProjectLibrary(libraryId),
    enabled: libraryIdValid,
  })

  if (!libraryIdValid) {
    return <Navigate to="/libraries" replace />
  }

  if (query.isLoading) {
    return (
      <div className="text-muted-foreground flex min-h-0 min-w-0 flex-1 items-center justify-center p-8 text-sm">
        加载项目库…
      </div>
    )
  }

  if (query.isError || !query.data) {
    return <Navigate to="/libraries" replace />
  }

  writeLastProjectLibraryId(libraryId)

  return (
    <ProjectLibraryProvider library={query.data}>{children}</ProjectLibraryProvider>
  )
}

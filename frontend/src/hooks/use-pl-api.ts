import { useMemo } from "react"
import { useParams } from "react-router"

import { useOptionalProjectLibrary } from "@/context/project-library"
import { plApiPath } from "@/lib/pl-api"

export function usePlApi() {
  const ctx = useOptionalProjectLibrary()
  const { libraryId: libraryIdParam } = useParams()
  const fromParam = Number(libraryIdParam)
  const libraryId = ctx?.libraryId ?? fromParam

  if (!Number.isFinite(libraryId) || libraryId <= 0) {
    throw new Error("usePlApi 须在 /libraries/:libraryId 路由内使用")
  }

  return useMemo(
    () => ({
      libraryId,
      path: (suffix: string) => plApiPath(libraryId, suffix),
    }),
    [libraryId]
  )
}

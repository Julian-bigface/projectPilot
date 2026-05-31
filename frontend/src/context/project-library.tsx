import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import { useParams } from "react-router"

import type { ProjectLibrary } from "@/types/project-library"

type ProjectLibraryContextValue = {
  libraryId: number
  library: ProjectLibrary | null
  setLibraryMeta: (lib: ProjectLibrary) => void
}

const ProjectLibraryContext = createContext<ProjectLibraryContextValue | null>(null)

export function ProjectLibraryProvider({
  library,
  children,
}: {
  library: ProjectLibrary | null
  children: ReactNode
}) {
  const { libraryId: libraryIdParam } = useParams()
  const libraryId = Number(libraryIdParam)

  const value = useMemo(
    (): ProjectLibraryContextValue => ({
      libraryId,
      library,
      setLibraryMeta: () => {
        /* 由 useQuery 刷新；保留扩展点 */
      },
    }),
    [libraryId, library]
  )

  return (
    <ProjectLibraryContext.Provider value={value}>{children}</ProjectLibraryContext.Provider>
  )
}

export function useProjectLibrary(): ProjectLibraryContextValue {
  const ctx = useContext(ProjectLibraryContext)
  if (!ctx) {
    throw new Error("useProjectLibrary 须在 ProjectLibraryProvider 内使用")
  }
  return ctx
}

export function useOptionalProjectLibrary(): ProjectLibraryContextValue | null {
  return useContext(ProjectLibraryContext)
}

export function useProjectLibraryId(): number | null {
  const ctx = useOptionalProjectLibrary()
  if (!ctx || !Number.isFinite(ctx.libraryId)) {
    return null
  }
  return ctx.libraryId
}

export const LAST_PROJECT_LIBRARY_ID_KEY = "projectPilot.lastProjectLibraryId"

export function readLastProjectLibraryId(): number | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = window.localStorage.getItem(LAST_PROJECT_LIBRARY_ID_KEY)
    if (!raw) {
      return null
    }
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function writeLastProjectLibraryId(id: number): void {
  try {
    window.localStorage.setItem(LAST_PROJECT_LIBRARY_ID_KEY, String(id))
  } catch {
    /* ignore */
  }
}

export function clearLastProjectLibraryId(): void {
  try {
    window.localStorage.removeItem(LAST_PROJECT_LIBRARY_ID_KEY)
  } catch {
    /* ignore */
  }
}

export function useRememberProjectLibrary(): (id: number) => void {
  return useCallback((id: number) => {
    writeLastProjectLibraryId(id)
  }, [])
}

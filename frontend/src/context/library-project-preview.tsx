import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import type { Project } from "@/types/project"

type LibraryProjectPreviewContextValue = {
  previewProject: Project | null
  setPreviewProject: (p: Project | null) => void
}

const LibraryProjectPreviewContext = createContext<LibraryProjectPreviewContextValue | null>(null)

export function LibraryProjectPreviewProvider({ children }: { children: ReactNode }) {
  const [previewProject, setPreviewProjectState] = useState<Project | null>(null)

  const setPreviewProject = useCallback((p: Project | null) => {
    setPreviewProjectState(p)
  }, [])

  const value = useMemo(
    () => ({ previewProject, setPreviewProject }),
    [previewProject, setPreviewProject]
  )

  return (
    <LibraryProjectPreviewContext.Provider value={value}>{children}</LibraryProjectPreviewContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook must live next to context
export function useLibraryProjectPreview(): LibraryProjectPreviewContextValue {
  const ctx = useContext(LibraryProjectPreviewContext)
  if (!ctx) {
    throw new Error("useLibraryProjectPreview must be used within LibraryProjectPreviewProvider")
  }
  return ctx
}

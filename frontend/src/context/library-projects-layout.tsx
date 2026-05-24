import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type LibraryProjectsLayout = "grid" | "masonry"

const STORAGE_KEY = "projectPilot.libraryProjectsLayout"

function readLayoutFromStorage(): LibraryProjectsLayout {
  if (typeof window === "undefined") {
    return "grid"
  }
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === "masonry" || v === "grid") {
      return v
    }
  } catch {
    /* ignore */
  }
  return "grid"
}

type LibraryProjectsLayoutContextValue = {
  layout: LibraryProjectsLayout
  setLayout: (next: LibraryProjectsLayout) => void
}

const LibraryProjectsLayoutContext = createContext<LibraryProjectsLayoutContextValue | null>(null)

export function LibraryProjectsLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<LibraryProjectsLayout>(() => readLayoutFromStorage())

  const setLayout = useCallback((next: LibraryProjectsLayout) => {
    setLayoutState(next)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, layout)
    } catch {
      /* ignore */
    }
  }, [layout])

  const value = useMemo(() => ({ layout, setLayout }), [layout, setLayout])

  return (
    <LibraryProjectsLayoutContext.Provider value={value}>{children}</LibraryProjectsLayoutContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook must live next to context
export function useLibraryProjectsLayout(): LibraryProjectsLayoutContextValue {
  const ctx = useContext(LibraryProjectsLayoutContext)
  if (!ctx) {
    throw new Error("useLibraryProjectsLayout must be used within LibraryProjectsLayoutProvider")
  }
  return ctx
}

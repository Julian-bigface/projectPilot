import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react"

type LibraryFeatureDrawerContextValue = {
  /** 由 `AppLayout` 注册：展开右侧预览栏（若已折叠） */
  setEnsureOpenImpl: (fn: (() => void) | null) => void
  /** 资料库卡片单击预览等：保证右侧栏处于展开状态 */
  ensureFeatureDrawerOpen: () => void
}

const LibraryFeatureDrawerContext = createContext<LibraryFeatureDrawerContextValue | null>(null)

export function LibraryFeatureDrawerProvider({ children }: { children: ReactNode }) {
  const implRef = useRef<(() => void) | null>(null)

  const setEnsureOpenImpl = useCallback((fn: (() => void) | null) => {
    implRef.current = fn
  }, [])

  const ensureFeatureDrawerOpen = useCallback(() => {
    implRef.current?.()
  }, [])

  const value = useMemo(
    () => ({ setEnsureOpenImpl, ensureFeatureDrawerOpen }),
    [setEnsureOpenImpl, ensureFeatureDrawerOpen]
  )

  return <LibraryFeatureDrawerContext.Provider value={value}>{children}</LibraryFeatureDrawerContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook must live next to context
export function useLibraryFeatureDrawer(): LibraryFeatureDrawerContextValue {
  const ctx = useContext(LibraryFeatureDrawerContext)
  if (!ctx) {
    throw new Error("useLibraryFeatureDrawer must be used within LibraryFeatureDrawerProvider")
  }
  return ctx
}

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react"

import { scopesEqual } from "@/lib/library-scope-label"
import { DEFAULT_LIBRARY_SCOPE, type LibraryScope } from "@/types/library-scope"

type FolderSelectionUpdater = number | null | ((prev: number | null) => number | null)

type NavState = {
  scope: LibraryScope
  past: LibraryScope[]
  future: LibraryScope[]
}

type NavAction =
  | {
      type: "set_scope"
      update: LibraryScope | ((prev: LibraryScope) => LibraryScope)
    }
  | { type: "back" }
  | { type: "forward" }

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "set_scope": {
      const next =
        typeof action.update === "function" ? action.update(state.scope) : action.update
      if (scopesEqual(state.scope, next)) {
        return state
      }
      return {
        scope: next,
        past: [...state.past, state.scope],
        future: [],
      }
    }
    case "back": {
      if (state.past.length === 0) {
        return state
      }
      const prevScope = state.past[state.past.length - 1]!
      return {
        scope: prevScope,
        past: state.past.slice(0, -1),
        future: [state.scope, ...state.future],
      }
    }
    case "forward": {
      if (state.future.length === 0) {
        return state
      }
      const [nextScope, ...restFuture] = state.future
      return {
        scope: nextScope!,
        past: [...state.past, state.scope],
        future: restFuture,
      }
    }
  }
}

const initialNav: NavState = {
  scope: DEFAULT_LIBRARY_SCOPE,
  past: [],
  future: [],
}

type LibrarySelectionContextValue = {
  libraryScope: LibraryScope
  setLibraryScope: (update: LibraryScope | ((prev: LibraryScope) => LibraryScope)) => void
  /** 主区子文件夹磁贴：单击仅待定高亮（不切换 `libraryScope`）；双击进入由 `setLibraryScope` 清除 */
  pendingFolderId: number | null
  /** 仅用于主区磁贴单击选中（待定），传 `null` 清除 */
  setBrowsePendingFolderId: (id: number | null) => void
  selectedFolderId: number | null
  setSelectedFolderId: (update: FolderSelectionUpdater) => void
  libraryCanGoBack: boolean
  libraryCanGoForward: boolean
  goLibraryBack: () => void
  goLibraryForward: () => void
}

const LibrarySelectionContext = createContext<LibrarySelectionContextValue | null>(null)

export function LibrarySelectionProvider({ children }: { children: ReactNode }) {
  const [nav, dispatch] = useReducer(navReducer, initialNav)
  const [pendingFolderId, setPendingFolderId] = useState<number | null>(null)

  const libraryScope = nav.scope

  const setLibraryScope = useCallback(
    (update: LibraryScope | ((prev: LibraryScope) => LibraryScope)) => {
      setPendingFolderId(null)
      dispatch({ type: "set_scope", update })
    },
    []
  )

  const selectedFolderId = libraryScope.kind === "folder" ? libraryScope.folderId : null

  const setBrowsePendingFolderId = useCallback((id: number | null) => {
    setPendingFolderId(id)
  }, [])

  const setSelectedFolderId = useCallback((update: FolderSelectionUpdater) => {
    setPendingFolderId(null)
    dispatch({
      type: "set_scope",
      update: (prev) => {
        const prevId = prev.kind === "folder" ? prev.folderId : null
        const nextId = typeof update === "function" ? update(prevId) : update
        if (nextId === null) {
          return DEFAULT_LIBRARY_SCOPE
        }
        return { kind: "folder", folderId: nextId }
      },
    })
  }, [])

  const goLibraryBack = useCallback(() => {
    setPendingFolderId(null)
    dispatch({ type: "back" })
  }, [])

  const goLibraryForward = useCallback(() => {
    setPendingFolderId(null)
    dispatch({ type: "forward" })
  }, [])

  const libraryCanGoBack = nav.past.length > 0
  const libraryCanGoForward = nav.future.length > 0

  const value = useMemo(
    () => ({
      libraryScope,
      setLibraryScope,
      pendingFolderId,
      setBrowsePendingFolderId,
      selectedFolderId,
      setSelectedFolderId,
      libraryCanGoBack,
      libraryCanGoForward,
      goLibraryBack,
      goLibraryForward,
    }),
    [
      libraryScope,
      setLibraryScope,
      pendingFolderId,
      setBrowsePendingFolderId,
      selectedFolderId,
      setSelectedFolderId,
      libraryCanGoBack,
      libraryCanGoForward,
      goLibraryBack,
      goLibraryForward,
    ]
  )

  return <LibrarySelectionContext.Provider value={value}>{children}</LibrarySelectionContext.Provider>
}

/** @see LibrarySelectionProvider */
// eslint-disable-next-line react-refresh/only-export-components -- hook must live next to context
export function useLibrarySelection(): LibrarySelectionContextValue {
  const ctx = useContext(LibrarySelectionContext)
  if (!ctx) {
    throw new Error("useLibrarySelection must be used within LibrarySelectionProvider")
  }
  return ctx
}

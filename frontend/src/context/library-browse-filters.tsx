import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  hasActiveLibraryFilters,
  type LibraryBrowseFilterState,
  type TagMatchMode,
} from "@/lib/library-project-filters"
import { useLibrarySelection } from "@/context/library-selection"

type LibraryBrowseFiltersContextValue = LibraryBrowseFilterState & {
  setSearchQuery: (q: string) => void
  setSelectedTagIds: (ids: number[] | ((prev: number[]) => number[])) => void
  setTagMatchMode: (mode: TagMatchMode) => void
  setSelectedFolderIds: (ids: number[] | ((prev: number[]) => number[])) => void
  toggleTagId: (id: number) => void
  toggleFolderId: (id: number) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  folderFilterDisabled: boolean
}

const LibraryBrowseFiltersContext = createContext<LibraryBrowseFiltersContextValue | null>(null)

const EMPTY: LibraryBrowseFilterState = {
  searchQuery: "",
  selectedTagIds: [],
  tagMatchMode: "any",
  selectedFolderIds: [],
}

export function LibraryBrowseFiltersProvider({ children }: { children: ReactNode }) {
  const { libraryScope } = useLibrarySelection()
  const [state, setState] = useState<LibraryBrowseFilterState>(EMPTY)

  const folderFilterDisabled =
    libraryScope.kind === "uncategorized" || libraryScope.kind === "no_tags"

  const scopeKey =
    libraryScope.kind === "folder" ? `folder:${libraryScope.folderId}` : libraryScope.kind

  useEffect(() => {
    setState((prev) => ({ ...prev, selectedFolderIds: [] }))
  }, [scopeKey])

  useEffect(() => {
    if (folderFilterDisabled && state.selectedFolderIds.length > 0) {
      setState((prev) => ({ ...prev, selectedFolderIds: [] }))
    }
  }, [folderFilterDisabled, state.selectedFolderIds.length])

  const setSearchQuery = useCallback((searchQuery: string) => {
    setState((prev) => ({ ...prev, searchQuery }))
  }, [])

  const setSelectedTagIds = useCallback(
    (update: number[] | ((prev: number[]) => number[])) => {
      setState((prev) => ({
        ...prev,
        selectedTagIds: typeof update === "function" ? update(prev.selectedTagIds) : update,
      }))
    },
    []
  )

  const setTagMatchMode = useCallback((tagMatchMode: TagMatchMode) => {
    setState((prev) => ({ ...prev, tagMatchMode }))
  }, [])

  const setSelectedFolderIds = useCallback(
    (update: number[] | ((prev: number[]) => number[])) => {
      setState((prev) => ({
        ...prev,
        selectedFolderIds: typeof update === "function" ? update(prev.selectedFolderIds) : update,
      }))
    },
    []
  )

  const toggleTagId = useCallback((id: number) => {
    setState((prev) => {
      const has = prev.selectedTagIds.includes(id)
      return {
        ...prev,
        selectedTagIds: has
          ? prev.selectedTagIds.filter((x) => x !== id)
          : [...prev.selectedTagIds, id],
      }
    })
  }, [])

  const toggleFolderId = useCallback((id: number) => {
    setState((prev) => {
      const has = prev.selectedFolderIds.includes(id)
      return {
        ...prev,
        selectedFolderIds: has
          ? prev.selectedFolderIds.filter((x) => x !== id)
          : [...prev.selectedFolderIds, id],
      }
    })
  }, [])

  const clearFilters = useCallback(() => {
    setState(EMPTY)
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      setSearchQuery,
      setSelectedTagIds,
      setTagMatchMode,
      setSelectedFolderIds,
      toggleTagId,
      toggleFolderId,
      clearFilters,
      hasActiveFilters: hasActiveLibraryFilters(state),
      folderFilterDisabled,
    }),
    [
      state,
      setSearchQuery,
      setSelectedTagIds,
      setTagMatchMode,
      setSelectedFolderIds,
      toggleTagId,
      toggleFolderId,
      clearFilters,
      folderFilterDisabled,
    ]
  )

  return (
    <LibraryBrowseFiltersContext.Provider value={value}>{children}</LibraryBrowseFiltersContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook must live next to context
export function useLibraryBrowseFilters(): LibraryBrowseFiltersContextValue {
  const ctx = useContext(LibraryBrowseFiltersContext)
  if (!ctx) {
    throw new Error("useLibraryBrowseFilters must be used within LibraryBrowseFiltersProvider")
  }
  return ctx
}

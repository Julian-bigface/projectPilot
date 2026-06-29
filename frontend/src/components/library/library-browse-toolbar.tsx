import { ChevronDown, Clock, Folder, Tags } from "lucide-react"
import { forwardRef, useMemo, type ReactNode } from "react"

import { LibraryAddedTimeFilterPanel } from "@/components/library/library-added-time-filter-panel"
import { LibraryFolderFilterPanel } from "@/components/library/library-folder-filter-panel"
import { LibraryTagFilterPanel } from "@/components/library/library-tag-filter-panel"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLibraryBrowseFilters } from "@/context/library-browse-filters"
import { useLibrarySelection } from "@/context/library-selection"
import {
  collectDirectChildFolderEntries,
  collectFolderFilterEntries,
  findFolderNode,
  type FolderFilterEntry,
} from "@/lib/library-tree"
import { cn } from "@/lib/utils"
import type { LibraryTreeResponse } from "@/types/library"
import type { Project } from "@/types/project"

type LibraryBrowseToolbarProps = {
  tree: LibraryTreeResponse | undefined
  scopeFiles: Project[]
}

const FilterPill = forwardRef<
  HTMLButtonElement,
  {
    active?: boolean
    disabled?: boolean
    onClick?: () => void
    label: string
    showTooltip?: boolean
    children: ReactNode
    className?: string
  }
>(function FilterPill(
  { active, disabled, onClick, label, showTooltip = true, children, className },
  ref
) {
  const button = (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-label={label}
      className={cn(
        "hover:bg-muted/50 relative inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-1.5 transition-colors disabled:pointer-events-none disabled:opacity-50",
        active && "bg-primary/10 text-foreground",
        className
      )}
      onClick={onClick}
    >
      {children}
      <ChevronDown className="text-muted-foreground size-3 shrink-0" aria-hidden />
    </button>
  )

  if (!showTooltip) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
})

export function LibraryBrowseToolbar({ tree, scopeFiles }: LibraryBrowseToolbarProps) {
  const { libraryScope } = useLibrarySelection()
  const {
    selectedTagIds,
    selectedFolderIds,
    addedTimePreset,
    folderFilterDisabled,
    hasActiveFilters,
    clearFilters,
  } = useLibraryBrowseFilters()

  const folderEntries = useMemo((): FolderFilterEntry[] => {
    if (!tree?.folders) {
      return []
    }
    if (libraryScope.kind === "folder") {
      const node = findFolderNode(tree.folders, libraryScope.folderId)
      if (!node) {
        return []
      }
      return collectDirectChildFolderEntries(node)
    }
    if (libraryScope.kind === "all" || libraryScope.kind === "folders_all") {
      return collectFolderFilterEntries(tree.folders)
    }
    return []
  }, [tree?.folders, libraryScope])

  const tagsActive = selectedTagIds.length > 0
  const foldersActive = selectedFolderIds.length > 0
  const timeActive = addedTimePreset !== null

  return (
    <section aria-label="筛选" className="-mt-3 -mb-3 flex flex-wrap items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <FilterPill active={tagsActive} label="标签" showTooltip={false}>
            <Tags className="size-3.5 shrink-0 opacity-90" aria-hidden />
            {tagsActive ? (
              <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[9px] leading-none font-medium tabular-nums">
                {selectedTagIds.length}
              </span>
            ) : null}
          </FilterPill>
        </PopoverTrigger>
        <LibraryTagFilterPanel scopeProjects={scopeFiles} />
      </Popover>

      {folderFilterDisabled ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <FilterPill disabled active={foldersActive} label="文件夹" showTooltip={false}>
                <Folder className="size-3.5 shrink-0 opacity-80" aria-hidden />
              </FilterPill>
            </span>
          </TooltipTrigger>
          <TooltipContent>当前视图不支持按文件夹筛选</TooltipContent>
        </Tooltip>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <FilterPill active={foldersActive} label="文件夹" showTooltip={false}>
              <Folder className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {foldersActive ? (
                <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[9px] leading-none font-medium tabular-nums">
                  {selectedFolderIds.length}
                </span>
              ) : null}
            </FilterPill>
          </PopoverTrigger>
          <LibraryFolderFilterPanel entries={folderEntries} />
        </Popover>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <FilterPill active={timeActive} label="添加时间" showTooltip={false}>
            <Clock className="size-3.5 shrink-0 opacity-80" aria-hidden />
          </FilterPill>
        </PopoverTrigger>
        <LibraryAddedTimeFilterPanel />
      </Popover>

      {hasActiveFilters ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground ml-1 text-[11px] underline-offset-2 hover:underline"
          onClick={clearFilters}
        >
          清除筛选
        </button>
      ) : null}
    </section>
  )
}

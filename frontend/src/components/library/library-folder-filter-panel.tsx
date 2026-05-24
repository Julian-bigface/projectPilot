import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { PopoverContent } from "@/components/ui/popover"
import { useLibraryBrowseFilters } from "@/context/library-browse-filters"
import type { FolderFilterEntry } from "@/lib/library-tree"
import { cn } from "@/lib/utils"

type LibraryFolderFilterPanelProps = {
  entries: FolderFilterEntry[]
}

export function LibraryFolderFilterPanel({ entries }: LibraryFolderFilterPanelProps) {
  const { selectedFolderIds, toggleFolderId, setSelectedFolderIds } = useLibraryBrowseFilters()
  const [folderSearch, setFolderSearch] = useState("")

  const visible = useMemo(() => {
    const q = folderSearch.trim().toLowerCase()
    if (!q) {
      return entries
    }
    return entries.filter((e) => e.name.toLowerCase().includes(q))
  }, [entries, folderSearch])

  const allVisibleIds = useMemo(() => visible.map((e) => e.id), [visible])

  return (
    <PopoverContent
      className="w-[min(100vw-2rem,20rem)] p-0"
      align="start"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <div className="border-border border-b px-3 py-2">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
            placeholder="搜索文件夹"
            className="h-8 border-0 bg-muted/40 pl-8 text-xs shadow-none"
            aria-label="搜索文件夹"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            onClick={() => setSelectedFolderIds([])}
          >
            清空
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            onClick={() => setSelectedFolderIds(allVisibleIds)}
            disabled={allVisibleIds.length === 0}
          >
            全选当前列表
          </button>
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto px-2 py-2">
        {visible.length === 0 ? (
          <p className="text-muted-foreground px-1 py-2 text-xs">暂无文件夹</p>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((entry) => {
              const checked = selectedFolderIds.includes(entry.id)
              return (
                <li key={entry.id}>
                  <label
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-1"
                    style={{ paddingLeft: `${8 + entry.depth * 12}px` }}
                  >
                    <input
                      type="checkbox"
                      className="border-input text-primary focus-visible:ring-ring size-3.5 shrink-0 rounded border"
                      checked={checked}
                      onChange={() => toggleFolderId(entry.id)}
                    />
                    <span className={cn("min-w-0 truncate text-xs", checked && "font-medium")}>
                      {entry.name}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PopoverContent>
  )
}

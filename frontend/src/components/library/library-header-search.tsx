import { Search } from "lucide-react"

import { useLibraryBrowseFilters } from "@/context/library-browse-filters"
import { cn } from "@/lib/utils"

export function LibraryHeaderSearch() {
  const { searchQuery, setSearchQuery } = useLibraryBrowseFilters()

  return (
    <div
      className={cn(
        "group/search relative flex h-8 w-full min-w-0 items-center rounded-md",
        "border border-transparent bg-muted/25",
        "transition-[background-color,box-shadow]",
        "hover:bg-background hover:shadow-[inset_0_0_0_1px_hsl(var(--border)/0.5)]",
        "focus-within:bg-background focus-within:shadow-[inset_0_0_0_1px_hsl(var(--border)/0.6)]"
      )}
    >
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="搜索"
        className="text-foreground placeholder:text-muted-foreground/50 h-8 min-w-0 w-full rounded-md border-0 bg-transparent py-0 pr-3 pl-8 text-xs shadow-none outline-none focus-visible:outline-none focus-visible:ring-0"
        aria-label="搜索项目"
      />
    </div>
  )
}

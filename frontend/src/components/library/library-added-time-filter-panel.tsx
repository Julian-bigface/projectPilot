import { PopoverContent } from "@/components/ui/popover"
import { useLibraryBrowseFilters } from "@/context/library-browse-filters"
import {
  ADDED_TIME_PRESET_LABELS,
  type AddedTimePreset,
} from "@/lib/library-project-filters"
import { cn } from "@/lib/utils"

const PRESET_ORDER: AddedTimePreset[] = ["7d", "30d", "90d", "365d"]

export function LibraryAddedTimeFilterPanel() {
  const { addedTimePreset, setAddedTimePreset } = useLibraryBrowseFilters()

  return (
    <PopoverContent
      className="w-[min(100vw-2rem,14rem)] p-0"
      align="start"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <div className="border-border border-b px-3 py-2">
        <p className="text-muted-foreground text-[11px]">按项目收录时间筛选当前列表</p>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mt-2 text-xs underline-offset-2 hover:underline"
          onClick={() => setAddedTimePreset(null)}
        >
          不限
        </button>
      </div>
      <ul className="space-y-0.5 px-2 py-2" role="listbox" aria-label="添加时间">
        {PRESET_ORDER.map((preset) => {
          const selected = addedTimePreset === preset
          return (
            <li key={preset}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "hover:bg-muted/50 flex w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  selected && "bg-primary/10 font-medium"
                )}
                onClick={() => setAddedTimePreset(selected ? null : preset)}
              >
                {ADDED_TIME_PRESET_LABELS[preset]}
              </button>
            </li>
          )
        })}
      </ul>
    </PopoverContent>
  )
}

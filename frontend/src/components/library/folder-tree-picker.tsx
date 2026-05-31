import { ChevronDown } from "lucide-react"
import { useMemo, useRef, useState, type WheelEvent } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { FolderFilterEntry } from "@/lib/library-tree"
import { folderTreeEntryPaddingLeft } from "@/lib/library-tree"
import { cn } from "@/lib/utils"

export type FolderTreePickerProps = {
  id?: string
  entries: FolderFilterEntry[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** 表示「未选具体文件夹」的 value，默认 `none`（如根目录） */
  emptyValue?: string
  rootLabel?: string
  placeholder?: string
  className?: string
}

function stopWheelBubble(e: WheelEvent<HTMLElement>) {
  e.stopPropagation()
}

export function FolderTreePicker({
  id,
  entries,
  value,
  onChange,
  disabled,
  emptyValue = "none",
  rootLabel = "根目录",
  placeholder = "选择文件夹",
  className,
}: FolderTreePickerProps) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedEntry = useMemo(() => {
    if (value === emptyValue) return null
    const idNum = Number(value)
    if (!Number.isFinite(idNum)) return null
    return entries.find((e) => e.id === idNum) ?? null
  }, [entries, value, emptyValue])

  const triggerLabel = selectedEntry?.name ?? (value === emptyValue ? rootLabel : placeholder)

  const handleListWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = listRef.current
    if (!el) return
    e.stopPropagation()
    if (el.scrollHeight <= el.clientHeight) return
    el.scrollTop += e.deltaY
    e.preventDefault()
  }

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "border-input bg-background h-9 w-full justify-between px-3 font-normal shadow-none",
            className
          )}
        >
          <span className="min-w-0 truncate text-sm">{triggerLabel}</span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={stopWheelBubble}
      >
        <div
          ref={listRef}
          className="main-auto-scrollbar max-h-64 overflow-y-auto overscroll-contain"
          onWheel={handleListWheel}
        >
          <button
            type="button"
            className={cn(
              "hover:bg-accent flex w-full rounded-sm px-2 py-1.5 text-left text-sm",
              value === emptyValue && "bg-accent font-medium"
            )}
            onClick={() => {
              onChange(emptyValue)
              setOpen(false)
            }}
          >
            {rootLabel}
          </button>
          {entries.length === 0 ? (
            <p className="text-muted-foreground px-2 py-2 text-xs">暂无文件夹</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {entries.map((entry) => {
                const selected = value === String(entry.id)
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={cn(
                        "hover:bg-accent flex w-full min-w-0 truncate rounded-sm py-1.5 pr-2 text-left text-sm",
                        selected && "bg-accent font-medium"
                      )}
                      style={{ paddingLeft: `${folderTreeEntryPaddingLeft(entry.depth)}px` }}
                      onClick={() => {
                        onChange(String(entry.id))
                        setOpen(false)
                      }}
                    >
                      {entry.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

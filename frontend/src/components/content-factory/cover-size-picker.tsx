import { Ratio } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  formatCoverSizeLabel,
  getReadmeCoverPreset,
  README_COVER_SIZE_PRESETS,
} from "@/lib/readme-cover-presets"
import { cn } from "@/lib/utils"

export function CoverSizePicker({
  presetId,
  disabled,
  onPresetChange,
}: {
  presetId: string
  disabled?: boolean
  onPresetChange: (presetId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = getReadmeCoverPreset(presetId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          className="absolute right-2 bottom-2 z-10 h-8 gap-1.5 px-2.5 text-xs shadow-md"
          aria-label="选择封面比例与像素"
        >
          <Ratio className="size-3.5 shrink-0" aria-hidden />
          <span className="font-medium">{current.ratio}</span>
          <span className="text-muted-foreground hidden sm:inline">
            {current.width}×{current.height}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={8} className="w-64 p-2">
        <p className="text-muted-foreground mb-2 px-1 text-[11px]">封面输出比例与像素</p>
        <ul className="flex flex-col gap-0.5">
          {README_COVER_SIZE_PRESETS.map((preset) => {
            const selected = preset.id === presetId
            return (
              <li key={preset.id}>
                <button
                  type="button"
                  className={cn(
                    "hover:bg-muted/80 flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors",
                    selected && "bg-muted font-medium"
                  )}
                  onClick={() => {
                    if (preset.id !== presetId) {
                      onPresetChange(preset.id)
                    }
                    setOpen(false)
                  }}
                >
                  <span className="text-sm">{preset.label}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {formatCoverSizeLabel(preset)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

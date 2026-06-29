import { Loader2, Wand2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  XHS_TITLE_LIMIT,
  countXhsTitleUnits,
  isXhsTitleOverLimit,
} from "@/lib/xhs-title-length"
import { cn } from "@/lib/utils"
import type { RecommendPlatform } from "@/types/content-factory"

export function PromotionTitlePicker({
  platform,
  title,
  titleOptions,
  suggesting,
  showCharCount,
  onSelectTitle,
  onSuggestTitles,
}: {
  platform: RecommendPlatform
  title: string
  titleOptions: string[]
  suggesting: boolean
  showCharCount: boolean
  onSelectTitle: (value: string) => void
  onSuggestTitles: () => void
}) {
  const [open, setOpen] = useState(false)
  const titleUnits = platform === "xiaohongshu" ? countXhsTitleUnits(title) : title.length
  const overLimit = platform === "xiaohongshu" && isXhsTitleOverLimit(title)

  const handleSelect = (value: string) => {
    onSelectTitle(value)
    setOpen(false)
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {showCharCount ? (
        <span
          className={cn(
            "text-muted-foreground text-xs tabular-nums",
            overLimit && "text-destructive font-medium"
          )}
        >
          {titleUnits} / {XHS_TITLE_LIMIT}
        </span>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-8 shrink-0"
            disabled={suggesting}
            aria-label="智能标题"
            title="智能标题"
          >
            {suggesting ? (
              <Loader2 className="size-4 animate-spin text-violet-500" aria-hidden />
            ) : (
              <Wand2 className="size-4 text-violet-500" aria-hidden />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-2">
          {titleOptions.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto">
              {titleOptions.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    className={cn(
                      "hover:bg-muted/70 w-full rounded-md px-3 py-2.5 text-left text-sm leading-snug transition-colors",
                      title === option && "bg-accent/60 font-medium"
                    )}
                    onClick={() => handleSelect(option)}
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-2 py-3 text-center text-xs">
              暂无标题候选，请先生成文案或点击下方按钮由 AI 生成
            </p>
          )}
          <div className="border-border mt-1 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs"
              disabled={suggesting}
              onClick={onSuggestTitles}
            >
              {suggesting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                  生成中…
                </>
              ) : (
                <>
                  <Wand2 className="mr-1.5 size-3.5 text-violet-500" aria-hidden />
                  {titleOptions.length > 0 ? "重新生成候选" : "AI 生成标题候选"}
                </>
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

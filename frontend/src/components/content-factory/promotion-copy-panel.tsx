import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import { toast } from "sonner"

import { PromotionBodyFloatingActions } from "@/components/content-factory/promotion-body-floating-actions"
import { PromotionBodySkeleton } from "@/components/content-factory/promotion-body-skeleton"
import { PromotionOptimizingIndicator } from "@/components/content-factory/promotion-optimizing-indicator"
import { PromotionTitlePicker } from "@/components/content-factory/promotion-title-picker"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { isPlatformView } from "@/lib/content-factory-views"
import { RECOMMEND_PLATFORMS, type ContentFactoryDraft, type ContentFactoryView } from "@/types/content-factory"

const MAX_TITLE_CHARS = 512
const MAX_BODY_CHARS = 1000

const fieldBase =
  "border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 resize-none"

export type PromotionCopyPanelHandle = {
  scrollBodyToEnd: () => void
}

type PromotionCopyPanelProps = {
  contentView: ContentFactoryView
  title: string
  titleOptions: string[]
  body: string
  regenerating: boolean
  optimizing: boolean
  optimizingRange: { start: number; end: number } | null
  suggestingTitles: boolean
  onViewChange: (view: ContentFactoryView) => void
  onTitleChange: (v: string) => void
  onSuggestTitles: () => void
  onBodyChange: (v: string) => void
  onRegenerate: () => void
  onOptimizeSelection: (payload: { text: string; start: number; end: number }) => void
  exportDraft: ContentFactoryDraft
}

export type BodySelection = {
  text: string
  start: number
  end: number
}

export const PromotionCopyPanel = forwardRef<PromotionCopyPanelHandle, PromotionCopyPanelProps>(
  function PromotionCopyPanel(
    {
      contentView,
      title,
      titleOptions,
      body,
      regenerating,
      optimizing,
      optimizingRange,
      suggestingTitles,
      onViewChange,
      onTitleChange,
      onSuggestTitles,
      onBodyChange,
      onRegenerate,
      onOptimizeSelection,
      exportDraft,
    },
    ref
  ) {
  const [titleFocused, setTitleFocused] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const bodyBusy = regenerating || optimizing
  const onPlatform = isPlatformView(contentView)
  const activePlatform = onPlatform ? contentView : "xiaohongshu"

  const readBodySelection = (): BodySelection | null => {
    const el = bodyRef.current
    if (!el) {
      return null
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = el.value.slice(start, end)
    if (start === end || !text.trim()) {
      return null
    }
    return { text, start, end }
  }

  const handleOptimizeMenu = () => {
    const selection = readBodySelection()
    if (!selection) {
      toast.error("请先选中要优化的文字")
      return
    }
    onOptimizeSelection(selection)
  }

  useImperativeHandle(ref, () => ({
    scrollBodyToEnd: () => {
      const el = bodyRef.current
      if (!el) {
        return
      }
      el.scrollTop = el.scrollHeight
      const end = el.value.length
      el.setSelectionRange(end, end)
      el.focus()
    },
  }))

  return (
    <div className="border-border flex h-full min-h-0 flex-col rounded-lg border bg-card">
      <div className="border-border flex items-center justify-between gap-3 border-b px-3 py-2">
        <button
          type="button"
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            contentView === "source"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
          onClick={() => onViewChange("source")}
        >
          原文
        </button>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {RECOMMEND_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                contentView === p.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
              onClick={() => onViewChange(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center gap-1 px-4">
          <Input
            aria-label="标题"
            className={cn(
              fieldBase,
              "text-foreground h-10 min-w-0 flex-1 text-base font-bold",
              "rounded-none",
              !titleFocused && "truncate"
            )}
            placeholder="标题"
            value={title}
            maxLength={MAX_TITLE_CHARS}
            onChange={(e) => onTitleChange(e.target.value)}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
          />
          {onPlatform ? (
            <PromotionTitlePicker
              platform={activePlatform}
              title={title}
              titleOptions={titleOptions}
              suggesting={suggestingTitles}
              showCharCount={titleFocused && activePlatform === "xiaohongshu"}
              onSelectTitle={onTitleChange}
              onSuggestTitles={onSuggestTitles}
            />
          ) : null}
        </div>

        <div className="group/body border-border/60 relative flex min-h-0 flex-1 flex-col border-t">
          {regenerating ? (
            <PromotionBodySkeleton />
          ) : (
            <>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <Textarea
                    ref={bodyRef}
                    aria-label="正文"
                    readOnly={optimizing}
                    className={cn(
                      fieldBase,
                      "text-foreground min-h-0 flex-1 overflow-y-auto px-4 py-2 text-sm leading-[1.75]",
                      "placeholder:text-muted-foreground/70",
                      optimizing && "opacity-90",
                      "group-hover/body:pb-10"
                    )}
                    placeholder="正文内容…"
                    value={body}
                    maxLength={MAX_BODY_CHARS}
                    onChange={(e) => onBodyChange(e.target.value)}
                  />
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                  <ContextMenuItem disabled={bodyBusy || !body.trim()} onSelect={handleOptimizeMenu}>
                    {optimizing ? (
                      <Loader2 className="mr-2 size-3.5 animate-spin text-violet-500" aria-hidden />
                    ) : (
                      <Sparkles className="mr-2 size-3.5 text-violet-500" aria-hidden />
                    )}
                    AI 优化选中
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem disabled={bodyBusy || !onPlatform} onSelect={onRegenerate}>
                    {regenerating ? (
                      <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="mr-2 size-3.5" aria-hidden />
                    )}
                    重新生成全文
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              {optimizing && optimizingRange ? (
                <PromotionOptimizingIndicator
                  textareaRef={bodyRef}
                  selectionRange={optimizingRange}
                />
              ) : null}
              <PromotionBodyFloatingActions draft={exportDraft} />
            </>
          )}
        </div>
      </div>
    </div>
  )
  }
)

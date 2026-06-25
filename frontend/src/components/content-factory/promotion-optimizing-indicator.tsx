import { Loader2, Sparkles } from "lucide-react"
import { useLayoutEffect, useRef, useState, type RefObject } from "react"

import { getTextareaCaretOffset } from "@/lib/textarea-caret-position"

const INDICATOR_GAP_PX = 4

function placeIndicatorBesideSelection(
  textarea: HTMLTextAreaElement,
  selectionRange: { start: number; end: number },
  indicatorWidth: number
): { top: number; left: number } {
  const endCoords = getTextareaCaretOffset(textarea, selectionRange.end)
  const computed = getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(computed.lineHeight) || 20
  const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0
  const paddingRight = Number.parseFloat(computed.paddingRight) || 0
  const contentRight = textarea.clientWidth - paddingRight
  const minLeft = paddingLeft

  let left = endCoords.left + INDICATOR_GAP_PX

  if (left + indicatorWidth > contentRight) {
    left = endCoords.left - indicatorWidth - INDICATOR_GAP_PX
  }

  left = Math.max(minLeft, Math.min(left, contentRight - indicatorWidth))

  const indicatorHeight = 28
  const top = endCoords.top + Math.max(0, (lineHeight - indicatorHeight) / 2)

  return { top: Math.max(0, top), left }
}

export function PromotionOptimizingIndicator({
  textareaRef,
  selectionRange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  selectionRange: { start: number; end: number }
}) {
  const indicatorRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    const indicator = indicatorRef.current
    if (!el || !indicator) {
      return
    }

    const update = () => {
      setPosition(
        placeIndicatorBesideSelection(el, selectionRange, indicator.offsetWidth || 96)
      )
    }

    update()
    el.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    return () => {
      el.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [textareaRef, selectionRange.end, selectionRange.start])

  return (
    <div
      ref={indicatorRef}
      className="bg-background/95 pointer-events-none absolute z-10 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 shadow-md backdrop-blur-sm"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <Sparkles className="absolute size-3.5 text-emerald-500" aria-hidden />
        <Loader2 className="size-4 animate-spin text-emerald-600/80" aria-hidden />
      </span>
      <span className="text-foreground text-xs font-medium">正在编写</span>
    </div>
  )
}

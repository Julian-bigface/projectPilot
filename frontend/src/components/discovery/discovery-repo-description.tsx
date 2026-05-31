import { useMutation } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { translatePlainText } from "@/lib/translate-plain-text"
import { cn } from "@/lib/utils"

export type DiscoveryRepoDescriptionProps = {
  description: string | null | undefined
  enriching?: boolean
}

const EXPAND_CHAR_THRESHOLD = 120

export function DiscoveryRepoDescription({
  description,
  enriching = false,
}: DiscoveryRepoDescriptionProps) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const [showTranslated, setShowTranslated] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)

  const source = description?.trim() ?? ""
  const canExpandByLength = source.length > EXPAND_CHAR_THRESHOLD
  const displaySource = showTranslated && translatedText ? translatedText : source
  const canTranslate = source.length > 0

  useEffect(() => {
    setExpanded(false)
    setShowTranslated(false)
    setTranslatedText(null)
  }, [source])

  useEffect(() => {
    const el = textRef.current
    if (!el || expanded || !source) {
      setClamped(canExpandByLength)
      return
    }
    const check = () => {
      setClamped(canExpandByLength || el.scrollHeight > el.clientHeight + 1)
    }
    check()
    const raf = window.requestAnimationFrame(check)
    return () => window.cancelAnimationFrame(raf)
  }, [source, displaySource, expanded, canExpandByLength])

  const translateMutation = useMutation({
    mutationFn: () => translatePlainText(source),
    onSuccess: (translated) => {
      setTranslatedText(translated)
      setShowTranslated(true)
      setExpanded(false)
    },
    onError: (err) => {
      toast.error((err as Error).message || "翻译失败")
    },
  })

  const translating = translateMutation.isPending

  const handleTranslateClick = () => {
    if (showTranslated && translatedText) {
      setShowTranslated(false)
      return
    }
    if (translatedText) {
      setShowTranslated(true)
      return
    }
    translateMutation.mutate()
  }

  if (!source) {
    if (enriching) {
      return <Skeleton className="mt-3 h-4 w-full max-w-lg" />
    }
    return <p className="text-muted-foreground mt-3 text-sm italic">暂无简介</p>
  }

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-foreground text-sm font-semibold tracking-tight">仓库简介</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {translating ? (
            <span className="text-muted-foreground text-xs whitespace-nowrap">正在翻译</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-7 shrink-0"
            aria-label={showTranslated ? "显示原文" : "翻译简介"}
            title={showTranslated ? "显示原文" : "翻译简介（不保存）"}
            disabled={!canTranslate || translating}
            onClick={handleTranslateClick}
          >
            <Sparkles className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <p
        ref={textRef}
        className={cn(
          "text-muted-foreground text-sm leading-relaxed",
          !expanded && "line-clamp-2"
        )}
      >
        {displaySource}
      </p>

      {clamped ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="text-muted-foreground h-auto px-0 text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : "展开"}
        </Button>
      ) : null}
    </div>
  )
}

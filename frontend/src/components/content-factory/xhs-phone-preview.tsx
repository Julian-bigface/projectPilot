import { useState } from "react"

import { XhsCoverPreviewContent } from "@/components/content-factory/xhs-cover-preview-content"
import { XhsNotePreviewContent } from "@/components/content-factory/xhs-note-preview-content"
import { cn } from "@/lib/utils"

type PreviewTab = "note" | "cover"

type XhsPhonePreviewProps = {
  title: string
  body: string
  coverUrl: string | null
  authorName?: string
  className?: string
}

export function XhsPhonePreview({
  title,
  body,
  coverUrl,
  authorName,
  className,
}: XhsPhonePreviewProps) {
  const [tab, setTab] = useState<PreviewTab>("note")

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          className={cn(
            "text-sm transition-colors",
            tab === "note" ? "text-foreground font-medium" : "text-muted-foreground"
          )}
          onClick={() => setTab("note")}
        >
          笔记预览
        </button>
        <button
          type="button"
          className={cn(
            "text-sm transition-colors",
            tab === "cover" ? "text-foreground font-medium" : "text-muted-foreground"
          )}
          onClick={() => setTab("cover")}
        >
          封面预览
        </button>
      </div>

      <div className="mx-auto w-full max-w-[280px]">
        <div className="border-border relative overflow-hidden rounded-[2rem] border-[6px] border-neutral-800 bg-neutral-800 shadow-xl">
          <div className="absolute top-1.5 left-1/2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-neutral-900" aria-hidden />
          <div
            className={cn(
              "flex h-[520px] flex-col overflow-hidden rounded-[1.4rem] bg-white",
              tab === "note" ? "pt-5" : "pt-0.5"
            )}
          >
            {tab === "note" ? (
              <XhsNotePreviewContent
                title={title}
                body={body}
                coverUrl={coverUrl}
                authorName={authorName}
              />
            ) : (
              <XhsCoverPreviewContent coverUrl={coverUrl} title={title} authorName={authorName} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

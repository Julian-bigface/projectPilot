import { Copy, Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { buildExportMarkdown } from "@/lib/content-factory-api"
import { cn } from "@/lib/utils"
import type { ContentFactoryDraft } from "@/types/content-factory"

export function PromotionBodyFloatingActions({ draft }: { draft: ContentFactoryDraft }) {
  const [exporting, setExporting] = useState(false)

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(buildExportMarkdown(draft))
      toast.success("已复制 Markdown")
    } catch {
      toast.error("复制失败")
    }
  }

  const downloadMd = () => {
    setExporting(true)
    try {
      const md = buildExportMarkdown(draft)
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${draft.project.name}-推荐稿.md`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("已下载 Markdown")
    } catch {
      toast.error("导出失败")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-2 bottom-2 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150",
        "group-hover/body:opacity-100 group-hover/body:pointer-events-auto"
      )}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="pointer-events-auto size-8 shadow-md"
        aria-label="复制 Markdown"
        title="复制 Markdown"
        onClick={() => void copyMarkdown()}
      >
        <Copy className="size-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        disabled={exporting}
        className="pointer-events-auto size-8 shadow-md"
        aria-label="下载 Markdown 文件"
        title="下载 .md"
        onClick={downloadMd}
      >
        <Download className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}

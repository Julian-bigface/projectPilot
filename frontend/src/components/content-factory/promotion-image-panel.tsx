import { Download, FolderOpen, ImageIcon, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState, type MutableRefObject, type WheelEvent } from "react"
import { Link } from "react-router"

import { CoverSizePicker } from "@/components/content-factory/cover-size-picker"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { coverProgressShowsDetail } from "@/lib/readme-cover-progress"
import type {
  ContentFactoryCopyJson,
  ContentFactoryProjectBrief,
  CoverStyleOption,
} from "@/types/content-factory"

/** 与模板占位预览同高，切换模板/生成封面时不跳动 */
const COVER_PREVIEW_HEIGHT_CLASS = "h-[280px] shrink-0"

function handleHorizontalWheelScroll(e: WheelEvent<HTMLDivElement>) {
  const el = e.currentTarget
  if (el.scrollWidth <= el.clientWidth) return
  e.preventDefault()
  e.stopPropagation()
  el.scrollLeft += e.deltaY
}

export function PromotionImagePanel({
  project,
  copy,
  selectedTemplate,
  styleOptions,
  coverUrl,
  coverGenerating,
  aiCoverGenerating,
  recommendImageReady,
  coverProgressSetterRef,
  coverSizePresetId,
  onCoverSizePresetChange,
  onTemplateChange,
  onRegenerateCover,
  onGenerateAiCover,
  onDownloadCover,
  onRevealCoverInFolder,
  onOpenStyleManage,
  onCoverImageLoad,
}: {
  project: ContentFactoryProjectBrief
  copy: ContentFactoryCopyJson | null
  selectedTemplate: string
  styleOptions: CoverStyleOption[]
  coverUrl: string | null
  coverGenerating: boolean
  aiCoverGenerating: boolean
  recommendImageReady: boolean
  coverProgressSetterRef?: MutableRefObject<((label: string | null) => void) | null>
  coverSizePresetId: string
  onCoverSizePresetChange: (presetId: string) => void
  onTemplateChange: (id: string) => void
  onRegenerateCover: () => void
  onGenerateAiCover: () => void
  onDownloadCover: () => void
  onRevealCoverInFolder?: () => void
  onOpenStyleManage?: () => void
  onCoverImageLoad?: () => void
}) {
  const [coverProgressLabel, setCoverProgressLabel] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null)
  const [coverLoadFailed, setCoverLoadFailed] = useState(false)

  useEffect(() => {
    setCoverLoadFailed(false)
  }, [coverUrl])

  useEffect(() => {
    if (!coverProgressSetterRef) {
      return
    }
    coverProgressSetterRef.current = setCoverProgressLabel
    return () => {
      coverProgressSetterRef.current = null
    }
  }, [coverProgressSetterRef])

  useEffect(() => {
    if (!coverGenerating) {
      setCoverProgressLabel(null)
    }
  }, [coverGenerating])

  const hook = copy?.hook || project.description || project.name
  const features = copy?.highlight_tags?.slice(0, 4) ?? []
  const isNativeReadme = selectedTemplate === "native-readme"
  const isAiTemplate = !isNativeReadme
  const hasCover = Boolean(coverUrl) && !coverLoadFailed
  const showProgressDetail = coverProgressShowsDetail(coverProgressLabel)
  const anyGenerating = coverGenerating || aiCoverGenerating

  const aiTemplateDisabled = isAiTemplate && !recommendImageReady
  const selectedStyleOption = useMemo(
    () => styleOptions.find((s) => s.id === selectedTemplate),
    [styleOptions, selectedTemplate]
  )
  const styleExampleUrl = selectedStyleOption?.example_image_url ?? null
  const showStyleExample = isAiTemplate && !hasCover && Boolean(styleExampleUrl)

  const openCoverLightbox = (url: string, alt: string) => {
    if (anyGenerating) return
    setLightbox({ url, alt })
  }

  return (
    <div className="border-border flex h-full min-h-0 flex-col rounded-lg border bg-card">
      <Tabs defaultValue="cover" className="flex min-h-0 flex-1 flex-col">
        <div className="border-border shrink-0 border-b px-3 pt-3">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="cover" className="flex-1 text-xs">
              封面图
            </TabsTrigger>
            <TabsTrigger value="grid" className="flex-1 text-xs" disabled>
              九宫格图
            </TabsTrigger>
            <TabsTrigger value="carousel" className="flex-1 text-xs" disabled>
              轮播图
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          value="cover"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3"
        >
          <div className="group relative flex shrink-0 items-center gap-1">
            <div
              className="main-auto-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-1"
              onWheel={handleHorizontalWheelScroll}
            >
              {styleOptions.map((tpl) => {
                const isAi = tpl.id !== "native-readme"
                const disabled = isAi && !recommendImageReady
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    title={
                      disabled
                        ? "请先在设置 → AI 配置推荐配图 API Key"
                        : undefined
                    }
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-1.5 text-[10px] transition-colors",
                      selectedTemplate === tpl.id
                        ? "border-amber-400 bg-amber-400/10 font-medium"
                        : "border-border hover:bg-muted/50",
                      disabled && "cursor-not-allowed opacity-45"
                    )}
                    disabled={disabled}
                    onClick={() => onTemplateChange(tpl.id)}
                  >
                    {tpl.label}
                  </button>
                )
              })}
            </div>
            {onOpenStyleManage ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                  "focus-visible:opacity-100"
                )}
                aria-label="管理风格库"
                onClick={onOpenStyleManage}
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>

          {!recommendImageReady ? (
            <p className="text-muted-foreground text-[10px] leading-relaxed">
              AI 风格封面需在{" "}
              <Link to="/settings/ai" className="text-primary underline-offset-2 hover:underline">
                设置 → AI
              </Link>{" "}
              配置「推荐配图」场景的 API Key 与模型。
            </p>
          ) : null}

          <div
            className={cn(
              "relative w-full overflow-hidden rounded-lg",
              COVER_PREVIEW_HEIGHT_CLASS,
              isNativeReadme || hasCover || showStyleExample
                ? "bg-muted/20"
                : "flex flex-col justify-between p-5",
              !hasCover &&
                !showStyleExample &&
                isAiTemplate &&
                selectedTemplate === "black-gold" &&
                "bg-zinc-900 text-amber-100",
              !hasCover &&
                !showStyleExample &&
                isAiTemplate &&
                selectedTemplate === "code-style" &&
                "bg-zinc-950 font-mono text-green-400",
              !hasCover &&
                !showStyleExample &&
                isAiTemplate &&
                selectedTemplate === "gradient" &&
                "bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-white",
              !hasCover &&
                !showStyleExample &&
                isAiTemplate &&
                selectedTemplate === "geek" &&
                "bg-slate-800 text-cyan-300",
              !hasCover &&
                !showStyleExample &&
                isAiTemplate &&
                (selectedTemplate === "minimal-tech" || !selectedTemplate) &&
                "border border-dashed bg-muted/30 text-foreground"
            )}
          >
            {hasCover ? (
              <>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div className="absolute inset-0">
                      <img
                        key={coverUrl!}
                        src={coverUrl!}
                        alt={`${project.name} 封面`}
                        title="双击查看大图"
                        className={cn(
                          "size-full object-contain object-center transition-opacity",
                          !anyGenerating && "cursor-zoom-in",
                          anyGenerating && "opacity-35"
                        )}
                        onDoubleClick={() =>
                          openCoverLightbox(coverUrl!, `${project.name} 封面`)
                        }
                        onLoad={() => onCoverImageLoad?.()}
                        onError={() => setCoverLoadFailed(true)}
                      />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem
                      disabled={anyGenerating}
                      onSelect={() =>
                        openCoverLightbox(coverUrl!, `${project.name} 封面`)
                      }
                    >
                      <ImageIcon className="mr-2 size-3.5" aria-hidden />
                      查看大图
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={anyGenerating || !onRevealCoverInFolder}
                      onSelect={() => onRevealCoverInFolder?.()}
                    >
                      <FolderOpen className="mr-2 size-3.5" aria-hidden />
                      打开所在文件夹
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                {anyGenerating ? (
                  <div className="text-muted-foreground pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/55 px-4 text-center backdrop-blur-[1px]">
                    <Loader2 className="size-8 animate-spin" aria-hidden />
                    <span className="text-foreground text-xs font-medium leading-relaxed">
                      {aiCoverGenerating
                        ? "正在 AI 生成封面…"
                        : (coverProgressLabel ?? "正在截取 README 封面…")}
                    </span>
                    {!showProgressDetail && !aiCoverGenerating ? (
                      <span className="text-muted-foreground/80 text-[10px]">
                        图片较多时会自动续载，请稍候
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : isNativeReadme ? (
              coverGenerating ? (
                <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                  <Loader2 className="size-8 animate-spin" aria-hidden />
                  <span className="text-foreground text-xs font-medium leading-relaxed">
                    {coverProgressLabel ?? "正在截取 README 封面…"}
                  </span>
                </div>
              ) : (
                <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                  <ImageIcon className="size-8 opacity-50" aria-hidden />
                  <p className="text-xs">点击上方「README 首屏」生成封面</p>
                </div>
              )
            ) : showStyleExample ? (
              <>
                <img
                  key={styleExampleUrl!}
                  src={styleExampleUrl!}
                  alt={`${selectedStyleOption?.label ?? "风格"} 示例`}
                  title="双击查看大图"
                  className={cn(
                    "absolute inset-0 size-full object-contain object-center transition-opacity",
                    !aiCoverGenerating && "cursor-zoom-in",
                    aiCoverGenerating && "opacity-35"
                  )}
                  onDoubleClick={() =>
                    openCoverLightbox(
                      styleExampleUrl!,
                      `${selectedStyleOption?.label ?? "风格"} 示例`
                    )
                  }
                />
                {aiCoverGenerating ? (
                  <div className="text-muted-foreground pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/55 px-4 text-center backdrop-blur-[1px]">
                    <Loader2 className="size-8 animate-spin" aria-hidden />
                    <span className="text-foreground text-xs font-medium leading-relaxed">
                      正在 AI 生成封面…
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div>
                  <p className="text-lg font-bold">{project.name}</p>
                  <p className="mt-2 text-sm opacity-90">{hook}</p>
                </div>
                {features.length > 0 ? (
                  <ul className="mt-4 space-y-1 text-xs">
                    {features.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 flex items-center gap-2 opacity-70">
                  <Sparkles className="size-4" aria-hidden />
                  <span className="text-[10px]">点击下方「生成封面」出 AI 宣传图</span>
                </div>
              </>
            )}
            <CoverSizePicker
              presetId={coverSizePresetId}
              disabled={anyGenerating}
              onPresetChange={onCoverSizePresetChange}
            />
          </div>

          <div className="flex shrink-0 gap-2">
            {isAiTemplate ? (
              <Button
                type="button"
                className="flex-1"
                size="sm"
                disabled={aiTemplateDisabled || anyGenerating}
                onClick={hasCover ? onRegenerateCover : onGenerateAiCover}
              >
                {aiCoverGenerating ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                ) : hasCover ? (
                  <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                ) : (
                  <Sparkles className="mr-1.5 size-3.5" aria-hidden />
                )}
                {hasCover ? "重新生成" : "生成封面"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                size="sm"
                disabled={coverGenerating}
                onClick={onRegenerateCover}
              >
                {coverGenerating ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                )}
                重新生成
              </Button>
            )}
            <Button
              type="button"
              className={cn("flex-1", !isAiTemplate && "flex-1")}
              variant={isAiTemplate ? "outline" : "default"}
              size="sm"
              disabled={!hasCover || anyGenerating}
              onClick={onDownloadCover}
            >
              <Download className="mr-1.5 size-3.5" aria-hidden />
              下载图片
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null)
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-2 sm:p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>{lightbox?.alt ?? "封面大图"}</DialogTitle>
          </DialogHeader>
          {lightbox ? (
            <img
              src={lightbox.url}
              alt={lightbox.alt}
              className="max-h-[min(85vh,820px)] w-full object-contain object-center"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

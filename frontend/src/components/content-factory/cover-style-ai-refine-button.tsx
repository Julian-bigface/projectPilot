import { useMutation } from "@tanstack/react-query"
import { Loader2, Wand2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { refineContentFactoryCoverStyle } from "@/lib/content-factory-api"
import type { ContentFactoryCoverStyle } from "@/types/content-factory"

export function CoverStyleAiRefineButton({
  libraryId,
  enabled,
  snapshot,
  onApply,
}: {
  libraryId: number
  enabled: boolean
  snapshot: ContentFactoryCoverStyle
  onApply: (
    result: Awaited<ReturnType<typeof refineContentFactoryCoverStyle>>,
    instruction: string
  ) => void
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [instruction, setInstruction] = useState("")

  const refineMutation = useMutation({
    mutationFn: () =>
      refineContentFactoryCoverStyle(libraryId, {
        instruction: instruction.trim(),
        label: snapshot.label,
        design_analysis: snapshot.design_analysis ?? null,
        prompt_prefix: snapshot.prompt_prefix,
        prompt_template: snapshot.prompt_template,
        negative_prompt: snapshot.negative_prompt,
        color_tokens: snapshot.color_tokens,
        font_tokens: snapshot.font_tokens,
        style_report: snapshot.style_report ?? null,
      }),
    onSuccess: (data) => {
      onApply(data, instruction.trim())
      setInstruction("")
      setPopoverOpen(false)
      toast.success("已应用 AI 调整后的风格")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!enabled) {
    return null
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 shrink-0 gap-1 px-2 text-xs"
          disabled={refineMutation.isPending}
        >
          {refineMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Wand2 className="size-3.5" />
          )}
          AI 调整
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-3">
        <p className="text-muted-foreground text-xs leading-relaxed">
          描述修改意图，AI 将综合调整视觉解构、画面前缀、模板、负向提示与色板
        </p>
        <Textarea
          className="min-h-[96px] resize-none text-xs"
          placeholder="例如：标题再大一点、减少红色面积、改成更学术气质、负向里禁止渐变…"
          value={instruction}
          disabled={refineMutation.isPending}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              if (instruction.trim()) {
                refineMutation.mutate()
              }
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={refineMutation.isPending}
            onClick={() => setPopoverOpen(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={!instruction.trim() || refineMutation.isPending}
            onClick={() => refineMutation.mutate()}
          >
            {refineMutation.isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
            应用
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

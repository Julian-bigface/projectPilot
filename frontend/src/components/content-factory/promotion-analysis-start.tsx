import { CheckCircle2, Circle, Loader2, Sparkles, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AnalysisStepState } from "@/lib/run-project-promotion-analysis"

const PANEL_MIN_HEIGHT = "min-h-[22rem]"

function StepIcon({ status }: { status: AnalysisStepState["status"] }) {
  if (status === "done") {
    return <CheckCircle2 className="text-primary size-4 shrink-0" aria-hidden />
  }
  if (status === "running") {
    return <Loader2 className="text-primary size-4 shrink-0 animate-spin" aria-hidden />
  }
  if (status === "error") {
    return <XCircle className="text-destructive size-4 shrink-0" aria-hidden />
  }
  return <Circle className="text-muted-foreground/50 size-4 shrink-0" aria-hidden />
}

export function PromotionAnalysisStart({
  running,
  steps,
  onStart,
}: {
  running: boolean
  steps: AnalysisStepState[]
  onStart: () => void
}) {
  const showProgress = running || steps.some((step) => step.status !== "pending")
  const hasError = steps.some((step) => step.status === "error")

  return (
    <div
      className={cn(
        "border-border flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center",
        PANEL_MIN_HEIGHT
      )}
    >
      {!showProgress ? (
        <>
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="text-primary size-5" aria-hidden />
          </div>
          <p className="text-foreground mb-1 text-sm font-medium">开启项目分析</p>
          <p className="text-muted-foreground mx-auto mb-5 max-w-md text-sm">
            点击下方按钮，AI 将读取项目资料并生成推荐文案。
          </p>
          <Button type="button" onClick={onStart}>
            开始分析
          </Button>
        </>
      ) : (
        <div className="mx-auto flex w-full max-w-sm flex-col text-left">
          <p className="text-foreground mb-4 min-h-5 text-center text-sm font-medium">
            {hasError ? "分析未完成" : running ? "正在分析项目…" : "分析完成"}
          </p>
          <ol className="space-y-2" aria-label="项目分析步骤">
            {steps.map((step) => (
              <li key={step.id} className="flex min-h-11 items-start gap-3">
                <StepIcon status={step.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      step.status === "running" && "text-foreground font-medium",
                      step.status === "done" && "text-foreground",
                      step.status === "pending" && "text-muted-foreground",
                      step.status === "error" && "text-destructive font-medium"
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className="text-muted-foreground mt-0.5 h-4 truncate text-xs"
                    aria-hidden={!step.detail}
                  >
                    {step.detail ?? "\u00a0"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex min-h-9 items-center justify-center">
            {hasError ? (
              <Button type="button" variant="outline" size="sm" disabled={running} onClick={onStart}>
                重试
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

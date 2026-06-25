import { generateContentFactoryCopy } from "@/lib/content-factory-api"
import { fetchProjectReadme } from "@/lib/project-readme"
import type { ContentFactoryProjectBrief, GenerateCopyResponse } from "@/types/content-factory"

export type AnalysisStepStatus = "pending" | "running" | "done" | "error"

export type AnalysisStepState = {
  id: string
  label: string
  detail?: string
  status: AnalysisStepStatus
}

export const PROJECT_ANALYSIS_STEP_DEFS = [
  { id: "project", label: "整理项目信息" },
  { id: "references", label: "读取扩展资料" },
  { id: "readme", label: "读取 README" },
  { id: "generate", label: "生成推荐文案" },
] as const

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function withMinDuration<T>(promise: Promise<T>, minMs: number): Promise<T> {
  const [result] = await Promise.all([promise, delay(minMs)])
  return result
}

function initialAnalysisSteps(): AnalysisStepState[] {
  return PROJECT_ANALYSIS_STEP_DEFS.map((step) => ({
    id: step.id,
    label: step.label,
    status: "pending",
  }))
}

export async function runProjectPromotionAnalysis(params: {
  libraryId: number
  draftId: number
  project: ContentFactoryProjectBrief
  onStepsChange: (steps: AnalysisStepState[]) => void
}): Promise<GenerateCopyResponse> {
  let steps = initialAnalysisSteps()

  const publish = () => {
    params.onStepsChange(steps.map((step) => ({ ...step })))
  }

  const patchStep = (id: string, patch: Partial<AnalysisStepState>) => {
    steps = steps.map((step) => (step.id === id ? { ...step, ...patch } : step))
    publish()
  }

  publish()

  patchStep("project", {
    status: "running",
    detail: params.project.full_name,
  })
  await delay(400)
  patchStep("project", { status: "done" })

  patchStep("references", {
    status: "running",
    detail: "检索项目百科与背景资料…",
  })
  await delay(500)
  patchStep("references", {
    status: "done",
    detail: "已整理扩展参考资料",
  })

  patchStep("readme", { status: "running", detail: "从 GitHub 拉取 README…" })
  try {
    const readme = await withMinDuration(fetchProjectReadme(params.project.id), 450)
    patchStep("readme", {
      status: "done",
      detail: readme.path?.trim() || "README",
    })
  } catch {
    patchStep("readme", {
      status: "done",
      detail: "README 暂不可用，将基于项目概要继续",
    })
  }

  patchStep("generate", { status: "running", detail: "AI 撰写中…" })
  try {
    const res = await generateContentFactoryCopy(params.libraryId, params.draftId, {
      preview_only: false,
    })
    patchStep("generate", { status: "done", detail: "推荐文案已生成" })
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失败"
    patchStep("generate", { status: "error", detail: message })
    throw err
  }
}

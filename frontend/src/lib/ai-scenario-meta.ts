import type { LucideIcon } from "lucide-react"
import { Image, MessageSquare, Palette, Tags } from "lucide-react"

import type { AiScenarioId } from "@/lib/settings-ai"

export const SCENARIO_HINTS: Partial<Record<AiScenarioId, string>> = {
  tag_classification: "标签管理 → 未分类 → AI 整理未分类",
  recommend_copy: "内容工厂 → 项目推广文案",
  recommend_image: "内容工厂 AI 封面出图（RootFlowAI 等 /images/generations）",
  recommend_cover_style:
    "内容工厂 → 风格库 AI 生成；上传参考图需 vision 模型（如 MiniMax-M3、GPT-4o、Claude 3+、Gemini 等）",
}

export const SCENARIO_BADGES: Partial<
  Record<AiScenarioId, { label: string; className: string }>
> = {
  tag_classification: {
    label: "整理",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  recommend_copy: {
    label: "话术",
    className: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  recommend_image: {
    label: "配图",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  recommend_cover_style: {
    label: "风格",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
}

export const SCENARIO_ICONS: Partial<Record<AiScenarioId, LucideIcon>> = {
  tag_classification: Tags,
  recommend_copy: MessageSquare,
  recommend_image: Image,
  recommend_cover_style: Palette,
}

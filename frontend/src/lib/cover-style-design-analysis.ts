import type { CoverStyleDesignAnalysis } from "@/types/content-factory"

export function emptyCoverStyleDesignAnalysis(): CoverStyleDesignAnalysis {
  return {
    design_category: "",
    design_system: "",
    typography_strategy: {
      title_ratio: "",
      weight: "",
      hierarchy_levels: "",
    },
    layout_system: {
      structure: "",
      alignment: "",
    },
    color_strategy: {
      main_color: "",
      accent_color: "",
      background_note: "",
    },
    information_density: "",
    whitespace_usage: "",
    visual_components: [],
    overall_mood: "",
    unique_memory_point: "",
  }
}

export function normalizeCoverStyleDesignAnalysis(
  analysis: CoverStyleDesignAnalysis | null | undefined
): CoverStyleDesignAnalysis {
  if (!analysis) {
    return emptyCoverStyleDesignAnalysis()
  }
  return {
    ...emptyCoverStyleDesignAnalysis(),
    ...analysis,
    typography_strategy: {
      ...emptyCoverStyleDesignAnalysis().typography_strategy,
      ...analysis.typography_strategy,
    },
    layout_system: {
      ...emptyCoverStyleDesignAnalysis().layout_system,
      ...analysis.layout_system,
    },
    color_strategy: {
      ...emptyCoverStyleDesignAnalysis().color_strategy,
      ...analysis.color_strategy,
    },
    visual_components: [...(analysis.visual_components ?? [])],
  }
}

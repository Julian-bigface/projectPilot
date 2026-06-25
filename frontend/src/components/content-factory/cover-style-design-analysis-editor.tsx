import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { normalizeCoverStyleDesignAnalysis } from "@/lib/cover-style-design-analysis"
import { cn } from "@/lib/utils"
import type { CoverStyleDesignAnalysis } from "@/types/content-factory"

const EDITOR_TEXTAREA_CLASS = cn(
  "w-full min-w-0 rounded-sm border-0 bg-transparent px-2 py-1 text-xs shadow-none outline-none",
  "transition-[box-shadow] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0",
  "min-h-[1.5rem] resize-none overflow-hidden whitespace-pre-wrap [field-sizing:content] leading-relaxed"
)

type RowDef = {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
}

function EditableRow({ label, value, onChange }: RowDef) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground w-14 shrink-0 pt-0.5">{label}</dt>
      <dd className="min-w-0 flex-1">
        <Textarea
          rows={1}
          className={EDITOR_TEXTAREA_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </dd>
    </div>
  )
}

export function CoverStyleDesignAnalysisEditor({
  analysis,
  onChange,
  className,
}: {
  analysis: CoverStyleDesignAnalysis | null | undefined
  onChange: (value: CoverStyleDesignAnalysis) => void
  className?: string
}) {
  const value = normalizeCoverStyleDesignAnalysis(analysis)

  const patch = (partial: Partial<CoverStyleDesignAnalysis>) => {
    onChange({ ...value, ...partial })
  }

  const rows: RowDef[] = []
  const push = (key: string, label: string, fieldValue: string, onFieldChange: (v: string) => void) => {
    rows.push({ key, label, value: fieldValue, onChange: onFieldChange })
  }

  push("design_category", "类别", value.design_category, (v) => patch({ design_category: v }))
  push("design_system", "体系", value.design_system, (v) => patch({ design_system: v }))
  push("overall_mood", "气质", value.overall_mood, (v) => patch({ overall_mood: v }))
  push("layout_structure", "布局", value.layout_system.structure, (v) =>
    patch({ layout_system: { ...value.layout_system, structure: v } })
  )
  push("title_ratio", "标题占比", value.typography_strategy.title_ratio, (v) =>
    patch({ typography_strategy: { ...value.typography_strategy, title_ratio: v } })
  )
  push("information_density", "信息密度", value.information_density, (v) =>
    patch({ information_density: v })
  )
  push("whitespace_usage", "留白", value.whitespace_usage, (v) => patch({ whitespace_usage: v }))

  return (
    <div className={cn("border-border bg-muted/20 rounded-md border p-3 text-xs leading-relaxed", className)}>
      <p className="text-foreground mb-2 font-medium">视觉解构</p>
      <dl className="grid gap-1.5">
        {rows.map(({ key, ...row }) => (
          <EditableRow key={key} {...row} />
        ))}
      </dl>
      <div className="mt-2 flex gap-2">
        <Label className="text-muted-foreground w-14 shrink-0 pt-0.5 text-xs font-normal">组件</Label>
        <div className="min-w-0 flex-1">
          <Textarea
            rows={1}
            className={EDITOR_TEXTAREA_CLASS}
            placeholder="每行一个，或用顿号分隔"
            value={value.visual_components.join("、")}
            onChange={(e) => {
              const next = e.target.value
                .split(/\n|[；;、]/)
                .map((item) => item.trim())
                .filter(Boolean)
              patch({ visual_components: next })
            }}
          />
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Label className="text-muted-foreground w-14 shrink-0 pt-0.5 text-xs font-normal">记忆点</Label>
        <div className="min-w-0 flex-1">
          <Textarea
            rows={1}
            className={EDITOR_TEXTAREA_CLASS}
            value={value.unique_memory_point}
            onChange={(e) => patch({ unique_memory_point: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}

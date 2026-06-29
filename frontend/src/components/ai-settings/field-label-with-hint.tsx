import { CircleHelp } from "lucide-react"
import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type FieldLabelWithHintProps = {
  htmlFor: string
  children: ReactNode
  hint: ReactNode
}

export function FieldLabelWithHint({ htmlFor, children, hint }: FieldLabelWithHintProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 rounded-sm p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="查看说明"
          >
            <CircleHelp className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

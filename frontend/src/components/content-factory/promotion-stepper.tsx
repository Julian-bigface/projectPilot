import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { PROMOTION_STEPS } from "@/types/content-factory"

export function PromotionStepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
      {PROMOTION_STEPS.map((step, index) => {
        const done = currentStep > step.id
        const active = currentStep === step.id
        return (
          <li key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-primary text-primary-foreground",
                active && !done && "bg-primary/15 text-primary ring-2 ring-primary/30",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : step.id}
            </div>
            <span
              className={cn(
                "text-xs sm:text-sm",
                active ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {index < PROMOTION_STEPS.length - 1 ? (
              <div className="bg-border hidden h-px w-6 sm:block" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

import { Check } from "lucide-react"



import { cn } from "@/lib/utils"

import { PROMOTION_STEPS } from "@/types/content-factory"



type PromotionStepperProps = {

  currentStep: number

  onStepClick?: (stepId: number) => void

  isStepClickable?: (stepId: number) => boolean

  stepCompleted?: (stepId: number) => boolean

  animatingStepId?: number | null

}



export function PromotionStepper({

  currentStep,

  onStepClick,

  isStepClickable,

  stepCompleted,

  animatingStepId,

}: PromotionStepperProps) {

  return (

    <ol className="flex flex-wrap items-center gap-2 sm:gap-4">

      {PROMOTION_STEPS.map((step, index) => {

        const completed = stepCompleted?.(step.id) ?? currentStep > step.id

        const active = currentStep === step.id && !completed

        const clickable = Boolean(onStepClick && isStepClickable?.(step.id))

        const animating = animatingStepId === step.id



        const handleClick = () => {

          if (!clickable || !onStepClick) {

            return

          }

          onStepClick(step.id)

        }



        return (

          <li key={step.id} className="flex items-center gap-2">

            <button

              type="button"

              disabled={!clickable}

              aria-current={active ? "step" : undefined}

              aria-label={`${step.label}${active ? "（当前）" : ""}${completed ? "（已完成）" : ""}`}

              className={cn(

                "flex items-center gap-2 rounded-md text-left transition-opacity",

                clickable && "cursor-pointer hover:opacity-80",

                !clickable && "cursor-default"

              )}

              onClick={handleClick}

            >

              <div

                className={cn(

                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-transform duration-300",

                  completed && "bg-primary text-primary-foreground",

                  active && !completed && "bg-primary/15 text-primary ring-2 ring-primary/30",

                  !completed && !active && "bg-muted text-muted-foreground",

                  animating && "scale-125 ring-2 ring-primary ring-offset-2"

                )}

              >

                {completed ? <Check className="size-3.5" aria-hidden /> : step.id}

              </div>

              <span

                className={cn(

                  "text-xs sm:text-sm",

                  active ? "text-foreground font-medium" : "text-muted-foreground"

                )}

              >

                {step.label}

              </span>

            </button>

            {index < PROMOTION_STEPS.length - 1 ? (

              <div className="bg-border hidden h-px w-6 sm:block" aria-hidden />

            ) : null}

          </li>

        )

      })}

    </ol>

  )

}


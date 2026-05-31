import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { WELCOME_SLIDES } from "@/config/welcome-slides"
import { cn } from "@/lib/utils"

const WHEEL_COOLDOWN_MS = 420

export function WelcomeCarousel() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const wheelAreaRef = useRef<HTMLDivElement>(null)
  const lastWheelAtRef = useRef(0)

  const onSelect = useCallback(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
  }, [api])

  useEffect(() => {
    if (!api) return
    onSelect()
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api, onSelect])

  const scrollPrev = useCallback(() => {
    api?.scrollPrev()
  }, [api])

  const scrollNext = useCallback(() => {
    api?.scrollNext()
  }, [api])

  useEffect(() => {
    const el = wheelAreaRef.current
    if (!el || !api) return

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 8) return
      event.preventDefault()

      const now = Date.now()
      if (now - lastWheelAtRef.current < WHEEL_COOLDOWN_MS) return
      lastWheelAtRef.current = now

      if (event.deltaY > 0) {
        api.scrollNext()
      } else {
        api.scrollPrev()
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [api])

  const chevronClass =
    "text-muted-foreground pointer-events-none absolute top-1/2 size-7 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 lg:size-8"

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div ref={wheelAreaRef} className="group/carousel relative min-h-0 w-full flex-1">
        <Carousel setApi={setApi} className="relative h-full w-full" opts={{ loop: true }}>
          <CarouselContent className="-ml-0 h-full">
            {WELCOME_SLIDES.map((slide) => {
              const Icon = slide.icon
              return (
                <CarouselItem key={slide.id} className="pl-0">
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-8 py-10 text-center lg:px-16 lg:py-14">
                    <div className="bg-primary/10 text-primary mb-8 flex size-20 items-center justify-center rounded-2xl lg:size-24">
                      <Icon className="size-10 lg:size-12" aria-hidden />
                    </div>
                    <h2 className="mb-4 max-w-2xl text-2xl font-semibold tracking-tight lg:text-3xl">
                      {slide.title}
                    </h2>
                    <p className="text-muted-foreground max-w-xl text-sm leading-relaxed lg:text-base">
                      {slide.description}
                    </p>
                    {slide.highlights?.length ? (
                      <ul className="mt-8 max-w-xl space-y-2.5 text-left text-sm lg:text-base">
                        {slide.highlights.map((item) => (
                          <li
                            key={item}
                            className="text-muted-foreground flex items-start gap-2.5 leading-relaxed"
                          >
                            <span
                              className="bg-primary mt-2 size-1.5 shrink-0 rounded-full"
                              aria-hidden
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>

          <button
            type="button"
            className="absolute inset-y-0 left-0 z-10 w-[19%] cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2"
            onClick={scrollPrev}
            aria-label="上一页"
          >
            <ChevronLeft className={cn(chevronClass, "left-5 lg:left-8")} aria-hidden />
          </button>
          <button
            type="button"
            className="absolute inset-y-0 right-0 z-10 w-[19%] cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2"
            onClick={scrollNext}
            aria-label="下一页"
          >
            <ChevronRight className={cn(chevronClass, "right-5 lg:right-8")} aria-hidden />
          </button>
        </Carousel>
      </div>

      <div className="flex shrink-0 justify-center gap-2 py-4" role="tablist" aria-label="介绍页指示">
        {WELCOME_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={index === current}
            aria-label={`第 ${index + 1} 页：${slide.title}`}
            className={cn(
              "size-2 rounded-full transition-colors",
              index === current ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            onClick={() => api?.scrollTo(index)}
          />
        ))}
      </div>
    </div>
  )
}

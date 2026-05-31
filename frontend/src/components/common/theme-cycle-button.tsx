import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useState } from "react"

import {
  nextThemeValue,
  THEME_CYCLE_LABELS,
  type ThemeCycleValue,
} from "@/lib/theme-cycle"
import { cn } from "@/lib/utils"

export const THEME_CYCLE_ICONS: Record<ThemeCycleValue, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function resolveThemeCycleValue(theme: string | undefined): ThemeCycleValue {
  if (theme === "light" || theme === "dark" || theme === "system") return theme
  return "system"
}

type ThemeCycleButtonProps = {
  className?: string
}

/** 语雀式小方钮：点击在浅色 / 深色 / 跟随系统间循环。 */
export function ThemeCycleButton({ className }: ThemeCycleButtonProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const themeValue = resolveThemeCycleValue(theme)
  const Icon = THEME_CYCLE_ICONS[themeValue]

  const cycleTheme = useCallback(() => {
    setTheme(nextThemeValue(theme))
  }, [setTheme, theme])

  if (!mounted) {
    return <span className={cn("inline-block size-8", className)} aria-hidden />
  }

  return (
    <button
      type="button"
      className={cn(
        "border-border bg-background hover:bg-accent flex size-8 shrink-0 items-center justify-center rounded-md border shadow-sm transition-colors",
        className
      )}
      onClick={cycleTheme}
      aria-label={`主题：${THEME_CYCLE_LABELS[themeValue]}，点击切换`}
      title={`主题：${THEME_CYCLE_LABELS[themeValue]}`}
    >
      <Icon className="text-muted-foreground size-3.5" aria-hidden />
    </button>
  )
}

export function useThemeCycleLabel(): string {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return "加载中…"
  return THEME_CYCLE_LABELS[resolveThemeCycleValue(theme)]
}

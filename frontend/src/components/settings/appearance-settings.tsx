import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const THEME_OPTIONS = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
] as const

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="border-border space-y-5 rounded-lg border p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">外观</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          选择浅色、深色或跟随系统。偏好保存在本浏览器，不会同步到服务器。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Label>主题</Label>
        {!mounted ? (
          <p className="text-muted-foreground text-sm">加载中…</p>
        ) : (
          <ToggleGroup
            type="single"
            variant="outline"
            value={theme ?? "system"}
            onValueChange={(value) => {
              if (value) setTheme(value)
            }}
            className="flex w-full max-w-md"
            aria-label="选择主题"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="flex flex-1 items-center justify-center gap-2 px-3"
                aria-label={label}
              >
                <Icon aria-hidden />
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>
    </section>
  )
}

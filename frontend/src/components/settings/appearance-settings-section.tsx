import { ThemeCycleButton, useThemeCycleLabel } from "@/components/common/theme-cycle-button"
import { SettingsRow } from "@/components/settings/settings-row"

export function AppearanceSettingsSection() {
  const themeLabel = useThemeCycleLabel()

  return (
    <SettingsRow
      label="主题"
      description="点击右侧按钮在浅色、深色与跟随系统间循环切换。偏好保存在本浏览器，不会同步到服务器。"
    >
      <div className="flex items-center justify-end gap-3 sm:ml-auto">
        <span className="text-muted-foreground text-sm">{themeLabel}</span>
        <ThemeCycleButton />
      </div>
    </SettingsRow>
  )
}

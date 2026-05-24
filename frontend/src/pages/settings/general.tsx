import { AppearanceSettings } from "@/components/settings/appearance-settings"

export function SettingsGeneralPage() {
  return (
    <div className="space-y-12">
      <header className="space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">通用设置</h1>
        <p className="text-muted-foreground max-w-2xl text-[15px] leading-[1.75] md:text-base md:leading-relaxed">
          集中配置 Project Pilot 的全局选项。外观偏好保存在本浏览器；GitHub Token 等集成请见侧栏「GitHub」。
        </p>
      </header>

      <AppearanceSettings />
    </div>
  )
}

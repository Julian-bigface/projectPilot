import { AppearanceSettingsSection } from "@/components/settings/appearance-settings-section"
import { SettingsSection } from "@/components/settings/settings-section"
import { TranslationSettingsSection } from "@/components/settings/translation-settings-section"

export function SettingsPage() {
  return (
    <div className="space-y-10 pb-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">偏好设置</h1>
      </header>

      <SettingsSection id="general" title="通用">
        <div className="border-border border-t">
          <AppearanceSettingsSection />
        </div>
      </SettingsSection>

      <hr className="border-border" />

      <TranslationSettingsSection />
    </div>
  )
}

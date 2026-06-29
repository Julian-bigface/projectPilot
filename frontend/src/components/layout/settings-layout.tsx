import { useEffect } from "react"
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router"

import { AiStudioShellLayout } from "@/components/layout/ai-studio-shell-layout"
import { useGithubSettingsDialog } from "@/context/github-settings-dialog"
import { useTranslationSettingsDialog } from "@/context/translation-settings-dialog"
import { SETTINGS_AI_ROUTE } from "@/lib/settings-sections"

export function SettingsLayout() {
  const navigate = useNavigate()
  const { pathname, hash } = useLocation()
  const { openDialog: openGithubSettings } = useGithubSettingsDialog()
  const { openDialog: openTranslationSettings } = useTranslationSettingsDialog()

  useEffect(() => {
    const legacySection = pathname.replace(/^\/settings\/?/, "")

    if (legacySection === "github") {
      openGithubSettings()
      navigate({ pathname: SETTINGS_AI_ROUTE.path }, { replace: true })
      return
    }

    if (legacySection === "ai") {
      navigate({ pathname: SETTINGS_AI_ROUTE.path }, { replace: true })
      return
    }

    if (hash === "#github") {
      openGithubSettings()
      navigate({ pathname: SETTINGS_AI_ROUTE.path, hash: "" }, { replace: true })
      return
    }

    if (hash === "#translation") {
      openTranslationSettings()
      navigate({ pathname: SETTINGS_AI_ROUTE.path, hash: "" }, { replace: true })
      return
    }

    if (legacySection === "general" || legacySection === "translation") {
      if (legacySection === "translation") {
        openTranslationSettings()
      }
      navigate({ pathname: SETTINGS_AI_ROUTE.path }, { replace: true })
    }
  }, [hash, navigate, openGithubSettings, openTranslationSettings, pathname])

  return (
    <Routes>
      <Route path="ai/*" element={<AiStudioShellLayout />} />
      <Route path="*" element={<Navigate to={SETTINGS_AI_ROUTE.path} replace />} />
    </Routes>
  )
}

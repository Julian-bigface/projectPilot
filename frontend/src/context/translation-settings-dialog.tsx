import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { TranslationSettingsDialog } from "@/components/settings/translation-settings-dialog"

type TranslationSettingsDialogContextValue = {
  openDialog: () => void
}

const TranslationSettingsDialogContext =
  createContext<TranslationSettingsDialogContextValue | null>(null)

export function TranslationSettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openDialog = useCallback(() => setOpen(true), [])

  const value = useMemo(() => ({ openDialog }), [openDialog])

  return (
    <TranslationSettingsDialogContext.Provider value={value}>
      {children}
      <TranslationSettingsDialog open={open} onOpenChange={setOpen} />
    </TranslationSettingsDialogContext.Provider>
  )
}

export function useTranslationSettingsDialog(): TranslationSettingsDialogContextValue {
  const ctx = useContext(TranslationSettingsDialogContext)
  if (!ctx) {
    throw new Error(
      "useTranslationSettingsDialog must be used within TranslationSettingsDialogProvider"
    )
  }
  return ctx
}

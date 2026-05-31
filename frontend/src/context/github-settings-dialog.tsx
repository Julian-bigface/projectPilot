import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useLocation, useNavigate } from "react-router"

import { GithubSettingsDialog } from "@/components/settings/github-settings-dialog"

type GithubSettingsDialogContextValue = {
  openDialog: () => void
}

const GithubSettingsDialogContext = createContext<GithubSettingsDialogContextValue | null>(null)

function GithubSettingsHashHandler({ openDialog }: { openDialog: () => void }) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (hash !== "#github") return
    openDialog()
    navigate({ pathname, hash: "" }, { replace: true })
  }, [hash, navigate, openDialog, pathname])

  return null
}

export function GithubSettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openDialog = useCallback(() => setOpen(true), [])

  const value = useMemo(() => ({ openDialog }), [openDialog])

  return (
    <GithubSettingsDialogContext.Provider value={value}>
      {children}
      <GithubSettingsHashHandler openDialog={openDialog} />
      <GithubSettingsDialog open={open} onOpenChange={setOpen} />
    </GithubSettingsDialogContext.Provider>
  )
}

export function useGithubSettingsDialog(): GithubSettingsDialogContextValue {
  const ctx = useContext(GithubSettingsDialogContext)
  if (!ctx) {
    throw new Error("useGithubSettingsDialog must be used within GithubSettingsDialogProvider")
  }
  return ctx
}

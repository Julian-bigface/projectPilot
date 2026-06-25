import { useCallback, useState, type ReactNode } from "react"

import { DiscoveryUncollectConfirmDialog } from "@/components/discovery/discovery-uncollect-confirm-dialog"
import { ImportToLibraryDialog } from "@/components/discovery/import-to-library-dialog"
import { useDiscoveryUncollect } from "@/hooks/use-discovery-uncollect"
import type { DiscoveryRepo } from "@/types/discovery"
import type { Project } from "@/types/project"

export function useDiscoveryCollectDialogs(options?: {
  onCollected?: (project: Project) => void
  onUncollected?: (projectId: number) => void
}) {
  const [importRepo, setImportRepo] = useState<DiscoveryRepo | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [uncollectOpen, setUncollectOpen] = useState(false)
  const [uncollectTarget, setUncollectTarget] = useState<{
    projectId: number
    fullName: string
  } | null>(null)

  const uncollectMutation = useDiscoveryUncollect({
    onSuccess: (projectId) => {
      setUncollectOpen(false)
      setUncollectTarget(null)
      options?.onUncollected?.(projectId)
    },
  })

  const requestCollect = useCallback((repo: DiscoveryRepo) => {
    setImportRepo(repo)
    setImportOpen(true)
  }, [])

  const requestUncollect = useCallback((projectId: number, fullName: string) => {
    setUncollectTarget({ projectId, fullName })
    setUncollectOpen(true)
  }, [])

  const handleImportOpenChange = useCallback((open: boolean) => {
    setImportOpen(open)
    if (!open) {
      setImportRepo(null)
    }
  }, [])

  const handleUncollectOpenChange = useCallback((open: boolean) => {
    setUncollectOpen(open)
    if (!open) {
      setUncollectTarget(null)
    }
  }, [])

  const confirmUncollect = useCallback(() => {
    if (uncollectTarget == null || uncollectMutation.isPending) {
      return
    }
    uncollectMutation.mutate(uncollectTarget.projectId)
  }, [uncollectMutation, uncollectTarget])

  const dialogs: ReactNode = (
    <>
      <ImportToLibraryDialog
        repo={importRepo}
        open={importOpen}
        onOpenChange={handleImportOpenChange}
        onImported={(project) => {
          options?.onCollected?.(project)
          setImportRepo(null)
        }}
      />
      <DiscoveryUncollectConfirmDialog
        open={uncollectOpen}
        onOpenChange={handleUncollectOpenChange}
        fullName={uncollectTarget?.fullName ?? ""}
        confirming={uncollectMutation.isPending}
        onConfirm={confirmUncollect}
      />
    </>
  )

  return {
    requestCollect,
    requestUncollect,
    dialogs,
    uncollectingProjectId: uncollectMutation.isPending
      ? (uncollectMutation.variables ?? null)
      : null,
  }
}

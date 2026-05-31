import { useCallback } from "react"
import { useSearchParams } from "react-router"

import { DiscoveryRepoReadmeTab } from "@/components/discovery/discovery-repo-readme-tab"
import { DiscoveryRepoReleasesTab } from "@/components/discovery/discovery-repo-releases-tab"
import { DiscoveryLibraryStarButton } from "@/components/discovery/discovery-library-star-button"
import {
  projectDetailTabContentClass,
  projectDetailTabTriggerClass,
  projectDetailTabsBarClass,
  projectDetailTabsListClass,
} from "@/components/project/detail/project-detail-tab-styles"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { parseProjectDetailTab, type ProjectDetailTab } from "@/types/project-github"
import type { DiscoveryRepo } from "@/types/discovery"

export type DiscoveryRepoDetailTabsProps = {
  owner: string
  repo: string
  discoveryRepo: DiscoveryRepo
  importedProjectId?: number | null
  fromPath?: string
  onImport?: () => void
}

const TAB_LABELS: Record<ProjectDetailTab, string> = {
  readme: "README",
  release: "Release",
  notes: "笔记",
}

export function DiscoveryRepoDetailTabs({
  owner,
  repo,
  discoveryRepo,
  importedProjectId = null,
  fromPath,
  onImport,
}: DiscoveryRepoDetailTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseProjectDetailTab(searchParams.get("tab"))

  const setTab = useCallback(
    (value: string) => {
      const next = parseProjectDetailTab(value)
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === "readme") {
            params.delete("tab")
          } else {
            params.set("tab", next)
          }
          return params
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const githubUrl = discoveryRepo.github_url || discoveryRepo.html_url

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className={projectDetailTabsBarClass}>
        <TabsList className={projectDetailTabsListClass}>
          {(Object.keys(TAB_LABELS) as ProjectDetailTab[]).map((key) => (
            <TabsTrigger key={key} value={key} className={projectDetailTabTriggerClass}>
              {TAB_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="readme" className={projectDetailTabContentClass}>
        <DiscoveryRepoReadmeTab
          owner={owner}
          repo={repo}
          githubUrl={githubUrl}
          enabled={tab === "readme"}
        />
      </TabsContent>

      <TabsContent value="release" className={projectDetailTabContentClass}>
        <DiscoveryRepoReleasesTab
          owner={owner}
          repo={repo}
          fullName={discoveryRepo.full_name}
          displayName={discoveryRepo.name}
          githubUrl={githubUrl}
          enabled={tab === "release"}
        />
      </TabsContent>

      <TabsContent value="notes" className={projectDetailTabContentClass}>
        <div className="border-border bg-muted/20 rounded-xl border border-dashed px-6 py-10 text-center">
          {importedProjectId ? (
            <>
              <p className="text-muted-foreground text-sm">已收录，可在项目详情中编辑笔记。</p>
              <div className="mt-4 flex justify-center">
                <DiscoveryLibraryStarButton
                  importedProjectId={importedProjectId}
                  fromPath={fromPath}
                  showImportedLabel
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">加入资料库后可编辑笔记。</p>
              {onImport ? (
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onImport}>
                  加入资料库
                </Button>
              ) : null}
            </>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

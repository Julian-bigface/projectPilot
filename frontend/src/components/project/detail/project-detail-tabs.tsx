import { useCallback } from "react"
import { useSearchParams } from "react-router"

import { ProjectDetailMoreInfo } from "@/components/project/detail/project-detail-more-info"
import {
  projectDetailTabContentClass,
  projectDetailTabTriggerClass,
  projectDetailTabsBarClass,
  projectDetailTabsListClass,
} from "@/components/project/detail/project-detail-tab-styles"
import { ProjectNotesTab } from "@/components/project/detail/project-notes-tab"
import { ProjectReadmeTab } from "@/components/project/detail/project-readme-tab"
import { ProjectReleasesTab } from "@/components/project/detail/project-releases-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { parseProjectDetailTab, type ProjectDetailTab } from "@/types/project-github"
import type { Project } from "@/types/project"

export type ProjectDetailTabsProps = {
  project: Project
}

const TAB_LABELS: Record<ProjectDetailTab, string> = {
  readme: "README",
  release: "Release",
  notes: "笔记",
}

export function ProjectDetailTabs({ project }: ProjectDetailTabsProps) {
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
        <ProjectDetailMoreInfo project={project} />
      </div>

      <TabsContent value="readme" className={projectDetailTabContentClass}>
        <ProjectReadmeTab
          projectId={project.id}
          githubUrl={project.github_url}
          enabled={tab === "readme"}
        />
      </TabsContent>

      <TabsContent value="release" className={projectDetailTabContentClass}>
        <ProjectReleasesTab
          projectId={project.id}
          githubUrl={project.github_url}
          enabled={tab === "release"}
        />
      </TabsContent>

      <TabsContent value="notes" className={projectDetailTabContentClass}>
        <ProjectNotesTab projectId={project.id} initialNotes={project.notes} />
      </TabsContent>
    </Tabs>
  )
}

import { ChevronRight } from "lucide-react"
import { useParams } from "react-router"

import { useQuery } from "@tanstack/react-query"
import { fetchContentFactoryDraft } from "@/lib/content-factory-api"

export function ContentFactoryPanelChrome() {
  const { libraryId: libraryIdParam, draftId: draftIdParam } = useParams()
  const libraryId = Number(libraryIdParam)
  const draftId = Number(draftIdParam)

  const draftQuery = useQuery({
    queryKey: ["content-factory", libraryId, "draft", draftId],
    queryFn: () => fetchContentFactoryDraft(libraryId, draftId),
    enabled: Number.isFinite(draftId) && draftId > 0,
  })

  const projectName = draftQuery.data?.project.name

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
      <span className="text-muted-foreground shrink-0">内容工厂</span>
      <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      <span className="text-muted-foreground shrink-0">项目推广</span>
      {projectName ? (
        <>
          <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <span className="text-foreground min-w-0 truncate font-medium">{projectName}</span>
        </>
      ) : null}
    </div>
  )
}

import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useLibrarySelection } from "@/context/library-selection"
import { usePlApi } from "@/hooks/use-pl-api"
import { getLibraryScopeDisplayLabel } from "@/lib/library-scope-label"
import type { LibraryTreeResponse } from "@/types/library"

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json()
    if (data && typeof data === "object" && "detail" in data) {
      const d = (data as { detail: unknown }).detail
      if (typeof d === "string") {
        return d
      }
      return JSON.stringify(d)
    }
  } catch {
    // ignore
  }
  return res.statusText || `HTTP ${res.status}`
}

export function LibraryPanelChrome() {
  const {
    libraryScope,
    libraryCanGoBack,
    libraryCanGoForward,
    goLibraryBack,
    goLibraryForward,
  } = useLibrarySelection()
  const plApi = usePlApi()

  const treeQuery = useQuery({
    queryKey: ["library", plApi.libraryId, "tree"],
    queryFn: async (): Promise<LibraryTreeResponse> => {
      const res = await fetch(plApi.path("/library/tree"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<LibraryTreeResponse>
    },
  })

  const label = getLibraryScopeDisplayLabel(libraryScope, treeQuery.data?.folders)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
        disabled={!libraryCanGoBack}
        onClick={goLibraryBack}
        aria-label="资料库后退"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
        disabled={!libraryCanGoForward}
        onClick={goLibraryForward}
        aria-label="资料库前进"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
      <span className="text-foreground min-w-0 truncate text-sm font-medium">{label}</span>
    </div>
  )
}

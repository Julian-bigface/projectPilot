import { ArrowLeft } from "lucide-react"
import { Link } from "react-router"

import { FunctionRail } from "@/components/layout/function-rail"
import { readLastProjectLibraryId } from "@/context/project-library"
import { AiStudioLayout } from "@/pages/ai-settings/layout"

export function AiStudioShellLayout() {
  const lastId = readLastProjectLibraryId()
  const backTo = lastId != null ? `/libraries/${lastId}` : "/libraries"

  return (
    <div className="bg-background flex h-svh min-h-0 w-full">
      <FunctionRail />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-border shrink-0 border-b px-6 py-4 md:px-10">
          <Link
            to={backTo}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            返回资料库
          </Link>
        </div>
        <main className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl px-8 py-10 md:px-12 md:py-14">
            <AiStudioLayout />
          </div>
        </main>
      </div>
    </div>
  )
}

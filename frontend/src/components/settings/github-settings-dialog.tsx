import { ChevronDown } from "lucide-react"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HoverHelp } from "@/components/ui/hover-help"
import { GithubTokenSettingsForm } from "@/components/settings/github-token-settings-form"
import { cn } from "@/lib/utils"

type GithubSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function GithubTokenHoverHelp() {
  const [permsOpen, setPermsOpen] = useState(false)

  return (
    <HoverHelp>
      <div className="space-y-3">
        <p>用于拉取仓库元数据、README 与发现中心数据。</p>

        <div className="space-y-1.5">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 text-left text-[11px] font-medium transition-colors"
            aria-expanded={permsOpen}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setPermsOpen((open) => !open)}
          >
            推荐权限
            <ChevronDown
              className={cn("size-3.5 shrink-0 transition-transform", permsOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {permsOpen ? (
            <ul className="space-y-1.5 pt-0.5">
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground shrink-0">Classic</span>
                <code className="bg-muted rounded px-1.5 py-0.5 text-[11px]">public_repo</code>
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground shrink-0">Fine-grained</span>
                <span className="text-right">Contents / metadata 只读</span>
              </li>
            </ul>
          ) : null}
        </div>

        <p className="text-muted-foreground border-border border-t pt-2.5 text-[11px] leading-snug">
          保存在本地 SQLite，界面仅显示掩码。
        </p>
      </div>
    </HoverHelp>
  )
}

export function GithubSettingsDialog({ open, onOpenChange }: GithubSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 overflow-visible sm:max-w-md">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2">
            GitHub Token
            <GithubTokenHoverHelp />
          </DialogTitle>
          <DialogDescription>更新 Personal Access Token 或测试当前连接。</DialogDescription>
        </DialogHeader>
        <GithubTokenSettingsForm />
      </DialogContent>
    </Dialog>
  )
}

import type { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { useGithubSettingsDialog } from "@/context/github-settings-dialog"
import { cn } from "@/lib/utils"

type GithubSettingsLinkProps = {
  children: ReactNode
  className?: string
}

/** 打开 GitHub Token 弹窗，替代原 `/settings#github` 链接。 */
export function GithubSettingsLink({ children, className }: GithubSettingsLinkProps) {
  const { openDialog } = useGithubSettingsDialog()

  return (
    <button
      type="button"
      className={cn("text-primary underline-offset-4 hover:underline", className)}
      onClick={openDialog}
    >
      {children}
    </button>
  )
}

export function GithubSettingsButton({
  children,
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  const { openDialog } = useGithubSettingsDialog()

  return (
    <Button
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          openDialog()
        }
      }}
    >
      {children}
    </Button>
  )
}

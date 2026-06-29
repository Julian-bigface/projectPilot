import { KeyRound, Languages, Loader2, LogOut, Sparkles } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ExternalLink } from "@/components/common/external-link"
import { AppVersionLabel } from "@/components/common/app-version-label"
import { ThemeCycleButton } from "@/components/common/theme-cycle-button"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useGithubSettingsDialog } from "@/context/github-settings-dialog"
import { useTranslationSettingsDialog } from "@/context/translation-settings-dialog"
import {
  fetchGithubProfile,
  fetchGithubSettings,
  putGithubSettings,
  type GithubProfileRead,
} from "@/lib/settings-github"
import { SETTINGS_AI_ROUTE } from "@/lib/settings-sections"
import { cn } from "@/lib/utils"

const menuItemClass =
  "hover:bg-accent flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors"

function profileDisplayName(profile: GithubProfileRead): string {
  return profile.name?.trim() || profile.login
}

function profileInitials(profile: GithubProfileRead | undefined): string {
  if (!profile) return "PP"
  const label = profileDisplayName(profile)
  return label.slice(0, 1).toUpperCase()
}

type RailUserMenuProps = {
  settingsActive?: boolean
}

export function RailUserMenu({ settingsActive = false }: RailUserMenuProps) {
  const queryClient = useQueryClient()
  const { openDialog: openGithubSettings } = useGithubSettingsDialog()
  const { openDialog: openTranslationSettings } = useTranslationSettingsDialog()
  const [open, setOpen] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ["settings", "github"],
    queryFn: fetchGithubSettings,
  })

  const profileQuery = useQuery({
    queryKey: ["settings", "github", "profile"],
    queryFn: fetchGithubProfile,
    enabled: settingsQuery.data?.has_token === true,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const logoutMutation = useMutation({
    mutationFn: () => putGithubSettings({ token: null }),
    onSuccess: async () => {
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["settings", "github"] })
      await queryClient.removeQueries({ queryKey: ["settings", "github", "profile"] })
    },
  })

  const profile = profileQuery.data
  const displayName = profile ? profileDisplayName(profile) : "Project Pilot"
  const canLogout = Boolean(settingsQuery.data?.token_preview)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "hover:bg-accent flex size-10 w-full items-center justify-center rounded-md transition-colors",
            (open || settingsActive) && "bg-accent"
          )}
          aria-label="账户与设置"
          title={displayName}
        >
          {profileQuery.isLoading && settingsQuery.data?.has_token ? (
            <Loader2 className="text-muted-foreground size-7 animate-spin" aria-hidden />
          ) : (
            <Avatar
              src={profile?.avatar_url}
              alt={displayName}
              fallback={profileInitials(profile)}
              className="size-7"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={8} className="w-72 p-0">
        <div className="flex items-start gap-3 p-4">
          <Avatar
            src={profile?.avatar_url}
            alt={displayName}
            fallback={profileInitials(profile)}
            className="size-10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{displayName}</p>
            {profile ? (
              <ExternalLink
                href={profile.html_url}
                className="text-muted-foreground hover:text-foreground mt-1 block truncate text-xs transition-colors"
              >
                @{profile.login}
              </ExternalLink>
            ) : profileQuery.isError ? (
              <p className="text-muted-foreground mt-1 text-xs">GitHub 已连接</p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">加载中…</p>
            )}
          </div>
        </div>

        <div className="border-border border-t px-2 py-1.5">
          <button
            type="button"
            className={menuItemClass}
            onClick={() => {
              setOpen(false)
              openGithubSettings()
            }}
          >
            <KeyRound className="text-muted-foreground size-4 shrink-0" aria-hidden />
            GitHub Token
          </button>

          <button
            type="button"
            className={menuItemClass}
            onClick={() => {
              setOpen(false)
              openTranslationSettings()
            }}
          >
            <Languages className="text-muted-foreground size-4 shrink-0" aria-hidden />
            翻译偏好
          </button>

          <Link
            to={SETTINGS_AI_ROUTE.path}
            onClick={() => setOpen(false)}
            className={menuItemClass}
          >
            <Sparkles className="text-muted-foreground size-4 shrink-0" aria-hidden />
            AI 工作室
          </Link>
        </div>

        <div className="border-border flex flex-col gap-2 border-t px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {canLogout ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 px-2 text-xs"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
              >
                {logoutMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="mr-1.5 size-3.5" aria-hidden />
                )}
                退出连接
              </Button>
            ) : (
              <span className="text-muted-foreground px-1 text-xs">Token 来自环境变量</span>
            )}

            <ThemeCycleButton />
          </div>
          <AppVersionLabel className="px-1" />
        </div>
      </PopoverContent>
    </Popover>
  )
}

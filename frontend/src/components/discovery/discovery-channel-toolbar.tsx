import { Search } from "lucide-react"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { parseTrendingRange } from "@/lib/discovery-api"
import {
  DEFAULT_TOPIC,
  TRENDING_RANGES,
  type DiscoveryChannelId,
} from "@/types/discovery"

export type DiscoveryChannelToolbarProps = {
  channelId: DiscoveryChannelId
}

export function discoveryChannelHasToolbar(channelId: DiscoveryChannelId): boolean {
  return channelId === "trending" || channelId === "topic"
}

export function DiscoveryChannelToolbar({ channelId }: DiscoveryChannelToolbarProps) {
  if (channelId === "trending") {
    return <TrendingRangeToolbar />
  }

  if (channelId === "topic") {
    return (
      <TopicSearchBar
        paramKey="topic"
        placeholder="GitHub Topic、中文关键词或标签分类名"
        defaultValue={DEFAULT_TOPIC}
      />
    )
  }

  return null
}

function TrendingRangeToolbar() {
  const [searchParams, setSearchParams] = useSearchParams()
  const range = parseTrendingRange(searchParams.get("range"))
  const [uiRange, setUiRange] = useState(range)

  useEffect(() => {
    setUiRange(range)
  }, [range])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs">时间范围</span>
      <ToggleGroup
        type="single"
        value={uiRange}
        onValueChange={(v) => {
          if (!v) return
          setUiRange(parseTrendingRange(v))
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set("range", v)
              next.delete("page")
              return next
            },
            { replace: true }
          )
        }}
        className="justify-start"
      >
        {TRENDING_RANGES.map((r) => (
          <ToggleGroupItem key={r.id} value={r.id} className="h-8 px-3 text-xs">
            {r.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

function TopicSearchBar({
  paramKey,
  placeholder,
  defaultValue,
}: {
  paramKey: "topic"
  placeholder: string
  defaultValue: string
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const current = searchParams.get(paramKey) ?? defaultValue
  const [draft, setDraft] = useState(current)

  const submit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()
      const trimmed = draft.trim()
      if (!trimmed) return
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(paramKey, trimmed)
          next.delete("page")
          return next
        },
        { replace: true }
      )
    },
    [draft, paramKey, setSearchParams]
  )

  return (
    <form className="flex max-w-md flex-1 items-center gap-2" onSubmit={submit}>
      <div className="relative min-w-0 flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="h-9 pl-9"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary">
        搜索
      </Button>
    </form>
  )
}

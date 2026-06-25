import type { DiscoveryRepoDelta } from "@/types/discovery"

export function formatDiscoveryDeltaValue(value: number): string {
  if (value > 0) {
    return `+${value.toLocaleString("zh-CN")}`
  }
  return value.toLocaleString("zh-CN")
}

export function discoveryDeltaTone(value: number): "up" | "down" | "neutral" {
  if (value > 0) {
    return "up"
  }
  if (value < 0) {
    return "down"
  }
  return "neutral"
}

export function formatDiscoveryRankDelta(rank: number): string {
  if (rank > 0) {
    return `↑${rank}`
  }
  if (rank < 0) {
    return `↓${Math.abs(rank)}`
  }
  return ""
}

/** 排名上升红色、下降绿色（与 Star/Fork 增减语义相反） */
export function discoveryRankDeltaClassName(rank: number): string {
  if (rank > 0) {
    return "text-red-600 dark:text-red-400"
  }
  if (rank < 0) {
    return "text-emerald-600 dark:text-emerald-400"
  }
  return "text-muted-foreground"
}

export function hasDiscoveryRepoDelta(delta: DiscoveryRepoDelta | null | undefined): boolean {
  if (!delta) {
    return false
  }
  if (delta.is_new) {
    return true
  }
  return delta.stars != null || delta.forks != null || delta.rank != null
}

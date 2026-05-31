import type { Project } from "@/types/project"

export async function fetchDiscoveryImportedMap(): Promise<Map<string, number>> {
  const res = await fetch("/api/projects?_start=0&_end=5000")
  if (!res.ok) {
    return new Map()
  }
  const rows = (await res.json()) as Project[]
  const map = new Map<string, number>()
  for (const p of rows) {
    if (p.deleted_at) continue
    map.set(p.full_name, p.id)
  }
  return map
}

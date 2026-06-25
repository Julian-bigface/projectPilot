import {
  clearLastProjectLibraryId,
  readLastProjectLibraryId,
} from "@/context/project-library"

export const LAST_CONTENT_FACTORY_LIBRARY_ID_KEY =
  "projectPilot.lastContentFactoryLibraryId"

export function readLastContentFactoryLibraryId(): number | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = window.localStorage.getItem(LAST_CONTENT_FACTORY_LIBRARY_ID_KEY)
    if (!raw) {
      return null
    }
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function writeLastContentFactoryLibraryId(id: number): void {
  try {
    window.localStorage.setItem(LAST_CONTENT_FACTORY_LIBRARY_ID_KEY, String(id))
  } catch {
    /* ignore */
  }
}

/** 功能区「内容工厂」直达链接（优先上次内容工厂所在库）。 */
export function contentFactoryEntryHref(): string {
  const cfLastId = readLastContentFactoryLibraryId()
  if (cfLastId !== null) {
    return `/libraries/${cfLastId}/content-factory/project-promotion`
  }
  const lastId = readLastProjectLibraryId()
  if (lastId !== null && lastId > 0) {
    return `/libraries/${lastId}/content-factory/project-promotion`
  }
  return "/content-factory"
}

async function projectLibraryExists(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/project-libraries/${id}`)
    return res.ok
  } catch {
    return false
  }
}

async function fetchFirstLibraryId(): Promise<number | null> {
  try {
    const res = await fetch("/api/project-libraries")
    if (!res.ok) {
      return null
    }
    const rows = (await res.json()) as Array<{ id: number }>
    const first = rows[0]?.id
    return typeof first === "number" && first > 0 ? first : null
  } catch {
    return null
  }
}

/** 解析内容工厂入口路径：优先上次内容工厂库，再上次项目库，否则取第一个库，最后回退目录页。 */
export async function resolveContentFactoryPath(): Promise<string> {
  const cfLastId = readLastContentFactoryLibraryId()
  if (cfLastId !== null && (await projectLibraryExists(cfLastId))) {
    return `/libraries/${cfLastId}/content-factory/project-promotion`
  }

  const lastId = readLastProjectLibraryId()
  if (lastId !== null && lastId > 0 && (await projectLibraryExists(lastId))) {
    return `/libraries/${lastId}/content-factory/project-promotion`
  }
  if (lastId !== null && !(await projectLibraryExists(lastId))) {
    clearLastProjectLibraryId()
  }

  const firstId = await fetchFirstLibraryId()
  if (firstId !== null) {
    return `/libraries/${firstId}/content-factory/project-promotion`
  }

  return "/libraries"
}

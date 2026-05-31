import {
  clearLastProjectLibraryId,
  readLastProjectLibraryId,
} from "@/context/project-library"

async function projectLibraryExists(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/project-libraries/${id}`)
    return res.ok
  } catch {
    return false
  }
}

/** 进入工具时的默认路径：有上次项目库且仍存在则进入该库，否则进入项目库目录页。 */
export async function resolveAppHomePath(): Promise<string> {
  const lastId = readLastProjectLibraryId()
  if (lastId === null) {
    return "/libraries"
  }

  if (await projectLibraryExists(lastId)) {
    return `/libraries/${lastId}`
  }

  clearLastProjectLibraryId()
  return "/libraries"
}

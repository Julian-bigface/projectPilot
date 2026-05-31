import { requestSaveFilePicker, saveBlobToUserDisk } from "@/lib/download-blob"
import { plApiPath } from "@/lib/pl-api"
import type { FolderBundle, FolderBundleImportResult } from "@/types/folder-bundle"

const BUNDLE_KIND = "project_pilot.folder_bundle"

export function isFolderBundle(value: unknown): value is FolderBundle {
  if (!value || typeof value !== "object") {
    return false
  }
  const o = value as Record<string, unknown>
  return o.format_version === 1 && o.kind === BUNDLE_KIND && Array.isArray(o.folders)
}

export function parseFolderBundleFileText(text: string): FolderBundle {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error("无法解析 JSON 文件")
  }
  if (!isFolderBundle(parsed)) {
    throw new Error("不是有效的 Project Pilot 文件夹包（.ppb.json）")
  }
  return parsed
}

export type ExportFolderBundleResult = {
  filename: string
  method: "picker" | "download"
}

export async function exportFolderBundle(
  libraryId: number,
  folderId: number,
  folderName: string
): Promise<ExportFolderBundleResult> {
  const suggested = `${folderName}.ppb.json`
  const pickerHandle = await requestSaveFilePicker(suggested)

  const url = plApiPath(libraryId, `/folders/${folderId}/export`)
  const res = await fetch(url)
  if (!res.ok) {
    let msg = res.statusText
    try {
      const data: unknown = await res.json()
      if (data && typeof data === "object" && "detail" in data) {
        const d = (data as { detail: unknown }).detail
        msg = typeof d === "string" ? d : JSON.stringify(d)
      }
    } catch {
      // ignore
    }
    throw new Error(msg || `导出失败 HTTP ${res.status}`)
  }
  const blob = await res.blob()
  return saveBlobToUserDisk(
    blob,
    suggested,
    res.headers.get("Content-Disposition"),
    pickerHandle
  )
}

export async function importFolderBundle(
  libraryId: number,
  targetParentFolderId: number | null,
  bundle: FolderBundle,
  options: { skipDuplicateGithubUrl?: boolean } = {}
): Promise<FolderBundleImportResult> {
  const res = await fetch(plApiPath(libraryId, "/import/folder-bundle"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bundle,
      target_parent_folder_id: targetParentFolderId,
      skip_duplicate_github_url: options.skipDuplicateGithubUrl ?? false,
    }),
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const data: unknown = await res.json()
      if (data && typeof data === "object" && "detail" in data) {
        const d = (data as { detail: unknown }).detail
        msg = typeof d === "string" ? d : JSON.stringify(d)
      }
    } catch {
      // ignore
    }
    throw new Error(msg || `导入失败 HTTP ${res.status}`)
  }
  return (await res.json()) as FolderBundleImportResult
}

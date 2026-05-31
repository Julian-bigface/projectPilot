/** 将 Blob 保存到用户磁盘：优先「另存为」对话框，否则触发浏览器下载。 */

type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandle>
}

export class SaveCancelledError extends Error {
  constructor() {
    super("SaveCancelled")
    this.name = "SaveCancelledError"
  }
}

export type SaveBlobResult = {
  filename: string
  /** picker = 用户选了保存路径；download = 走浏览器下载栏 */
  method: "picker" | "download"
}

function parseFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback
  }
  const star = /filename\*=UTF-8''([^;\s]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/"/g, ""))
    } catch {
      return fallback
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted?.[1]) {
    return quoted[1]
  }
  const plain = /filename=([^;\s]+)/i.exec(header)
  if (plain?.[1]) {
    return plain[1].replace(/"/g, "")
  }
  return fallback
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = objectUrl
  a.download = filename
  a.rel = "noopener"
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 过早 revoke 会导致 Chrome 下载失败或 0 字节文件
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

export type SaveFilePickerHandle = FileSystemFileHandle

/** 在用户点击后立即调用，以便保留手势并弹出「另存为」（需在拉取数据之前）。 */
export async function requestSaveFilePicker(
  suggestedName: string
): Promise<SaveFilePickerHandle | null> {
  const picker = (window as WindowWithSavePicker).showSaveFilePicker
  if (typeof picker !== "function") {
    return null
  }
  try {
    return await picker({
      suggestedName,
      types: [
        {
          description: "Project Pilot 文件夹包",
          accept: { "application/json": [".json", ".ppb.json"] },
        },
      ],
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new SaveCancelledError()
    }
    return null
  }
}

async function writeBlobToPickerHandle(
  handle: SaveFilePickerHandle,
  blob: Blob
): Promise<string> {
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
  return handle.name
}

export async function saveBlobToUserDisk(
  blob: Blob,
  suggestedName: string,
  contentDisposition?: string | null,
  pickerHandle?: SaveFilePickerHandle | null
): Promise<SaveBlobResult> {
  const fallback =
    suggestedName.endsWith(".json") || suggestedName.endsWith(".ppb.json")
      ? suggestedName
      : `${suggestedName}.ppb.json`
  const filename = parseFilenameFromDisposition(contentDisposition ?? null, fallback)

  if (pickerHandle) {
    const name = await writeBlobToPickerHandle(pickerHandle, blob)
    return { filename: name || filename, method: "picker" }
  }

  triggerBrowserDownload(blob, filename)
  return { filename, method: "download" }
}

import { toBlob } from "html-to-image"

import {
  getCachedInlineImage,
  getCaptureImageCacheSize,
  setCachedInlineImage,
} from "@/lib/readme-cover-image-cache"
import { truncateReadmeHeroMarkdown } from "@/lib/readme-cover-truncate"
import {
  DEFAULT_README_COVER_PRESET_ID,
  getCoverOutputSize,
  type CoverOutputSize,
} from "@/lib/readme-cover-presets"

/** 与资料库项目详情 README 标签正文列宽一致 */
export const README_CAPTURE_SOURCE_WIDTH = 640

/** 封面左右留白（源分辨率 px，随画布等比放大到 1242 宽） */
export const README_CAPTURE_PADDING_X = 40

/** 离屏截图强制浅色背景/文字，避免深色模式下白字白底 */
export const README_CAPTURE_LIGHT_BG = "#ffffff"
export const README_CAPTURE_LIGHT_TEXT = "#0a0a0a"

const README_CAPTURE_ROOT_ATTR = "data-readme-capture-root"
const README_CAPTURE_FULL_NAME_ATTR = "data-readme-full-name"
export const README_CAPTURE_CONTENT_ATTR = "data-readme-capture-content"

/** 导出 PNG 过小视为空白图（upscale 前兜底） */
const MIN_COVER_BLOB_BYTES = 8_192
/** 像素抽样网格边长；非背景像素占比低于此视为空白图 */
const BLANK_SAMPLE_GRID = 16
const BLANK_MIN_NON_BACKGROUND_RATIO = 0.005

/** 视口内 fixed 定位（opacity 须为 1，否则 html-to-image 截到空白） */
export function applyCaptureOffscreenStyles(
  el: HTMLElement,
  options?: { width?: number; height?: number }
): void {
  el.style.position = "fixed"
  el.style.top = "0"
  el.style.left = "0"
  el.style.zIndex = "-1"
  el.style.pointerEvents = "none"
  el.style.overflow = "hidden"
  el.style.boxSizing = "border-box"
  el.style.background = README_CAPTURE_LIGHT_BG
  el.style.color = README_CAPTURE_LIGHT_TEXT
  if (options?.width != null) {
    el.style.width = `${options.width}px`
  }
  if (options?.height != null) {
    el.style.height = `${options.height}px`
  }
}

export function cropHeightForWidth(
  sourceWidth: number,
  outputSize: CoverOutputSize = getCoverOutputSize(DEFAULT_README_COVER_PRESET_ID)
): number {
  return Math.round((sourceWidth * outputSize.height) / outputSize.width)
}

export function readmeImageProxyUrl(src: string): string {
  return `/api/projects/readme-image-proxy?url=${encodeURIComponent(src)}`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }
      reject(new Error("图片内联失败"))
    }
    reader.readAsDataURL(blob)
  })
}

const README_CAPTURE_VIEWPORT_IMAGE_TIMEOUT_MS = 8_000

export const README_CAPTURE_TIMEOUT_MS = 45_000
/** 续跑时图片大多已缓存，缩短整轮超时 */
export const README_CAPTURE_TIMEOUT_RESUMED_MS = 25_000

export const README_CAPTURE_MAX_ATTEMPTS = 3

export const README_CAPTURE_TIMEOUT_MESSAGE =
  "截图超时：README 图片过多或加载过慢，请稍后重试。"

export function isCaptureTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("截图超时")
}

export type CaptureViewportImageStats = {
  total: number
  loaded: number
  pending: number
}

export function getCaptureViewportImageStats(
  root: HTMLElement,
  viewportRoot: HTMLElement
): CaptureViewportImageStats {
  const imgs = getCaptureViewportImages(root, viewportRoot)
  const loaded = imgs.filter((img) => img.complete && img.naturalHeight > 0).length
  const pending = imgs.filter((img) => !img.complete).length
  return { total: imgs.length, loaded, pending }
}

export class CaptureIncompleteError extends Error {
  readonly stats: CaptureViewportImageStats

  constructor(stats: CaptureViewportImageStats) {
    super(
      stats.total > 0
        ? `封面图片尚未全部就绪（${stats.loaded}/${stats.total}）`
        : "封面尚未就绪"
    )
    this.name = "CaptureIncompleteError"
    this.stats = stats
  }
}

export function isCaptureIncompleteError(err: unknown): err is CaptureIncompleteError {
  return err instanceof CaptureIncompleteError
}

export function isCaptureEmptyBlobError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("生成内容为空")
}

function isNearBackgroundPixel(r: number, g: number, b: number, tolerance = 12): boolean {
  return r >= 255 - tolerance && g >= 255 - tolerance && b >= 255 - tolerance
}

/** 根据 RGB 抽样判断是否为空白图（供单测与 isCaptureBlobMostlyBlank 共用） */
export function isSampleSetMostlyBlank(
  pixels: ReadonlyArray<readonly [number, number, number]>
): boolean {
  if (pixels.length === 0) {
    return true
  }
  let nonBackground = 0
  for (const [r, g, b] of pixels) {
    if (!isNearBackgroundPixel(r, g, b)) {
      nonBackground += 1
    }
  }
  return nonBackground / pixels.length < BLANK_MIN_NON_BACKGROUND_RATIO
}

/** 抽样检测 PNG 是否几乎全白（upscale 前后均应调用） */
export async function isCaptureBlobMostlyBlank(blob: Blob): Promise<boolean> {
  if (blob.size < MIN_COVER_BLOB_BYTES) {
    return true
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("空白检测：无法读取图片。"))
      el.src = objectUrl
    })

    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    if (!ctx || canvas.width === 0 || canvas.height === 0) {
      return true
    }

    ctx.drawImage(img, 0, 0)
    const { width, height } = canvas
    const pixels: Array<[number, number, number]> = []

    for (let gy = 0; gy < BLANK_SAMPLE_GRID; gy += 1) {
      for (let gx = 0; gx < BLANK_SAMPLE_GRID; gx += 1) {
        const x = Math.min(
          width - 1,
          Math.floor(((gx + 0.5) / BLANK_SAMPLE_GRID) * width)
        )
        const y = Math.min(
          height - 1,
          Math.floor(((gy + 0.5) / BLANK_SAMPLE_GRID) * height)
        )
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
        pixels.push([r, g, b])
      }
    }

    return isSampleSetMostlyBlank(pixels)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function assertCaptureBlobHasContent(blob: Blob): Promise<void> {
  if (await isCaptureBlobMostlyBlank(blob)) {
    throw new Error("截图失败：生成内容为空，请重试。")
  }
}

/** 导出前确认 Markdown 已渲染出文字或图片 */
export function assertCaptureSurfaceReady(surface: HTMLElement): void {
  const stats = getCaptureViewportImageStats(surface, surface)
  const contentRoot =
    surface.querySelector(`[${README_CAPTURE_CONTENT_ATTR}]`) ?? surface
  const textLen = contentRoot.textContent?.trim().length ?? 0
  const hasLoadedImage = stats.loaded > 0

  if (textLen === 0 && !hasLoadedImage) {
    throw new CaptureIncompleteError(stats)
  }
}

export type ReadmeCoverExportResult = {
  blob: Blob
  stats: CaptureViewportImageStats
}

export type CaptureProgressUpdate = {
  phase: "layout" | "inline" | "wait" | "export"
  loaded: number
  total: number
}

export type ExportCoverOptions = {
  onProgress?: (update: CaptureProgressUpdate) => void
}

function getTopRelativeToViewport(el: Element, viewportRoot: HTMLElement): number {
  return el.getBoundingClientRect().top - viewportRoot.getBoundingClientRect().top
}

/** 按 DOM 顺序收集裁切区内的图片；遇首个顶边超出裁切高度的节点即停止 */
export function getCaptureViewportImages(
  root: HTMLElement,
  viewportRoot: HTMLElement
): HTMLImageElement[] {
  const cropHeight = viewportRoot.clientHeight
  const imgs = Array.from(root.querySelectorAll("img"))
  const result: HTMLImageElement[] = []

  for (const img of imgs) {
    const top = getTopRelativeToViewport(img, viewportRoot)
    if (top >= cropHeight) {
      break
    }
    result.push(img)
    const height = img.getBoundingClientRect().height || img.offsetHeight || 0
    if (height > 0 && top + height >= cropHeight) {
      break
    }
  }

  return result
}

/** 移除裁切区以下的图片 / picture，避免无意义代理与 html-to-image 遍历 */
export function stripBelowFoldImages(root: HTMLElement, viewportRoot: HTMLElement): void {
  const cropHeight = viewportRoot.clientHeight
  root.querySelectorAll("picture").forEach((picture) => {
    if (getTopRelativeToViewport(picture, viewportRoot) >= cropHeight) {
      picture.remove()
    }
  })
  root.querySelectorAll("img").forEach((img) => {
    if (getTopRelativeToViewport(img, viewportRoot) >= cropHeight) {
      img.remove()
    }
  })
}

async function ensureCaptureLayoutReady(
  signal?: AbortSignal,
  onProgress?: ExportCoverOptions["onProgress"]
): Promise<void> {
  onProgress?.({ phase: "layout", loaded: 0, total: 0 })
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  throwIfAborted(signal)
  await delay(350, signal)
}

async function fetchIntoCaptureImageCache(
  original: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (!original || original.startsWith("data:") || original.startsWith("blob:")) {
    return null
  }
  const hit = getCachedInlineImage(original)
  if (hit) {
    return hit
  }
  try {
    const res = await fetch(readmeImageProxyUrl(original), { signal })
    if (!res.ok) {
      return null
    }
    const dataUrl = await blobToDataUrl(await res.blob())
    setCachedInlineImage(original, dataUrl)
    return dataUrl
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err
    }
    return null
  }
}

async function inlineOneCaptureImage(
  img: HTMLImageElement,
  signal?: AbortSignal
): Promise<"fetched" | "cached" | "skipped"> {
  throwIfAborted(signal)
  const original = img.currentSrc || img.src
  const hadCache = Boolean(original && getCachedInlineImage(original))
  const dataUrl = await fetchIntoCaptureImageCache(original, signal)
  if (!dataUrl) {
    return "skipped"
  }
  img.src = dataUrl
  img.removeAttribute("srcset")
  return hadCache ? "cached" : "fetched"
}

/** 将裁切区内外链图片转为 data URL；自上而下顺序内联，折外图不处理 */
export async function inlineCaptureImages(
  root: HTMLElement,
  viewportRoot: HTMLElement = root,
  signal?: AbortSignal,
  onProgress?: ExportCoverOptions["onProgress"]
): Promise<{ fetched: number; cached: number }> {
  throwIfAborted(signal)
  const imgs = getCaptureViewportImages(root, viewportRoot)
  let fetched = 0
  let cached = 0

  onProgress?.({ phase: "inline", loaded: 0, total: imgs.length })

  for (let index = 0; index < imgs.length; index += 1) {
    const img = imgs[index]
    const result = await inlineOneCaptureImage(img, signal)
    if (result === "fetched") {
      fetched += 1
    } else if (result === "cached") {
      cached += 1
    }
    onProgress?.({ phase: "inline", loaded: index + 1, total: imgs.length })
  }

  return { fetched, cached }
}

/** 将 live 裁切区内图片预取进会话缓存，不修改 live DOM 的 img.src */
async function prefetchCaptureImageCacheFromLive(
  liveSurface: HTMLElement,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal)
  await waitForImages(liveSurface, liveSurface, signal)
  const imgs = getCaptureViewportImages(liveSurface, liveSurface)
  for (const img of imgs) {
    throwIfAborted(signal)
    const original = img.currentSrc || img.src
    await fetchIntoCaptureImageCache(original, signal)
  }
}

export async function waitForImages(
  root: HTMLElement,
  viewportRoot: HTMLElement = root,
  signal?: AbortSignal,
  onProgress?: ExportCoverOptions["onProgress"]
): Promise<void> {
  throwIfAborted(signal)
  const imgs = getCaptureViewportImages(root, viewportRoot)
  if (imgs.length === 0) {
    return
  }
  onProgress?.({ phase: "wait", loaded: 0, total: imgs.length })
  let settled = 0
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalHeight > 0) {
            settled += 1
            onProgress?.({ phase: "wait", loaded: settled, total: imgs.length })
            resolve()
            return
          }
          const timer = window.setTimeout(() => {
            settled += 1
            onProgress?.({ phase: "wait", loaded: settled, total: imgs.length })
            resolve()
          }, README_CAPTURE_VIEWPORT_IMAGE_TIMEOUT_MS)
          img.onload = () => {
            window.clearTimeout(timer)
            settled += 1
            onProgress?.({ phase: "wait", loaded: settled, total: imgs.length })
            resolve()
          }
          img.onerror = () => {
            window.clearTimeout(timer)
            settled += 1
            onProgress?.({ phase: "wait", loaded: settled, total: imgs.length })
            resolve()
          }
        })
    )
  )
}

/** 将 <picture> 展平为单个 <img>，避免 html-to-image 在 picture/source 上卡死 */
export function flattenCapturePictures(root: HTMLElement): void {
  root.querySelectorAll("picture").forEach((picture) => {
    const img = picture.querySelector("img")
    if (img) {
      picture.replaceWith(img.cloneNode(true))
      return
    }
    const src = [...picture.querySelectorAll("source")]
      .map((source) => source.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0])
      .find(Boolean)
    if (!src) {
      picture.remove()
      return
    }
    const fallback = document.createElement("img")
    fallback.src = src
    fallback.alt = picture.querySelector("img")?.alt ?? ""
    picture.replaceWith(fallback)
  })
}

export function withCaptureTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      reject(new Error(README_CAPTURE_TIMEOUT_MESSAGE))
    }, timeoutMs)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException("封面截图已取消", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    promise
      .then((value) => {
        window.clearTimeout(timer)
        signal?.removeEventListener("abort", onAbort)
        resolve(value)
      })
      .catch((err) => {
        window.clearTimeout(timer)
        signal?.removeEventListener("abort", onAbort)
        reject(err)
      })
  })
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("封面截图已取消", "AbortError")
  }
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException("封面截图已取消", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

const toPngOptions = (surface: HTMLElement) => {
  const width = surface.clientWidth
  const height = surface.clientHeight
  return {
    width,
    height,
    pixelRatio: 2,
    cacheBust: false,
    backgroundColor: "#ffffff",
    skipFonts: true,
    fetchRequestInit: { mode: "cors" as RequestMode, credentials: "omit" as RequestCredentials },
  }
}

function upscaleCoverBlobToOutput(blob: Blob, outputSize: CoverOutputSize): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement("canvas")
      canvas.width = outputSize.width
      canvas.height = outputSize.height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("截图失败：无法创建画布。"))
        return
      }
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, outputSize.width, outputSize.height)
      canvas.toBlob((out) => {
        if (!out) {
          reject(new Error("截图失败：未生成图片数据，请重试。"))
          return
        }
        resolve(out)
      }, "image/png")
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("截图失败：图片缩放失败。"))
    }
    img.src = objectUrl
  })
}

/** 仅处理裁切区内可见内容：折外图剥离后自上而下内联，再截图。
 *  禁止对 React 挂载的 live 节点调用；请使用 exportCoverBlobFromLiveSurface。 */
export async function exportCoverBlob(
  surface: HTMLElement,
  outputSize: CoverOutputSize = getCoverOutputSize(DEFAULT_README_COVER_PRESET_ID),
  signal?: AbortSignal,
  options?: ExportCoverOptions
): Promise<ReadmeCoverExportResult> {
  throwIfAborted(signal)
  await ensureCaptureLayoutReady(signal, options?.onProgress)
  flattenCapturePictures(surface)
  stripBelowFoldImages(surface, surface)
  throwIfAborted(signal)
  await inlineCaptureImages(surface, surface, signal, options?.onProgress)
  throwIfAborted(signal)
  await waitForImages(surface, surface, signal, options?.onProgress)
  throwIfAborted(signal)

  const stats = getCaptureViewportImageStats(surface, surface)
  if (stats.total > 0 && stats.loaded < stats.total) {
    throw new CaptureIncompleteError(stats)
  }

  options?.onProgress?.({ phase: "export", loaded: stats.loaded, total: stats.total })

  let blob: Blob | null = null
  try {
    blob = await toBlob(surface, toPngOptions(surface))
  } catch (err) {
    const detail =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "页面样式或外链图片无法导出"
    throw new Error(`截图失败：${detail}`)
  }
  if (!blob) {
    throw new Error("截图失败：未生成图片数据，请重试。")
  }
  throwIfAborted(signal)
  const outputBlob = await upscaleCoverBlobToOutput(blob, outputSize)
  throwIfAborted(signal)
  await assertCaptureBlobHasContent(outputBlob)
  return { blob: outputBlob, stats }
}

export type DisposableCaptureSurface = {
  disposable: HTMLElement
  cleanup: () => void
}

/** 从 live 表面深拷贝出一次性离屏容器，供 exportCoverBlob 破坏性处理 */
export function buildDisposableCaptureSurface(
  liveSurface: HTMLElement,
  outputSize: CoverOutputSize
): DisposableCaptureSurface {
  const width = liveSurface.clientWidth || README_CAPTURE_SOURCE_WIDTH
  const cropHeight = cropHeightForWidth(width, outputSize)

  const disposable = document.createElement("div")
  disposable.setAttribute("data-readme-cover-surface", "")
  disposable.setAttribute("data-readme-cover-clone", "")
  disposable.className = "light"
  applyCaptureOffscreenStyles(disposable, { width, height: cropHeight })
  disposable.style.paddingLeft = `${README_CAPTURE_PADDING_X}px`
  disposable.style.paddingRight = `${README_CAPTURE_PADDING_X}px`

  const mirrorSource =
    liveSurface.querySelector(`[${README_CAPTURE_CONTENT_ATTR}]`) ??
    liveSurface.querySelector(".group\\/readme-layout") ??
    liveSurface.firstElementChild ??
    liveSurface
  const mirror = mirrorSource.cloneNode(true) as HTMLElement
  mirror.style.margin = "0"
  mirror.style.width = "100%"
  mirror.style.height = "auto"
  if ("scrollTop" in mirror) {
    ;(mirror as HTMLElement & { scrollTop: number }).scrollTop = 0
  }
  disposable.appendChild(mirror)
  document.body.appendChild(disposable)

  return {
    disposable,
    cleanup: () => {
      disposable.remove()
    },
  }
}

/** 在 live 表面排版后克隆导出，不修改 React 管理的 DOM */
export async function exportCoverBlobFromLiveSurface(
  liveSurface: HTMLElement,
  outputSize: CoverOutputSize,
  signal?: AbortSignal,
  options?: ExportCoverOptions
): Promise<ReadmeCoverExportResult> {
  throwIfAborted(signal)
  const width = liveSurface.clientWidth || README_CAPTURE_SOURCE_WIDTH
  const cropHeight = cropHeightForWidth(width, outputSize)

  liveSurface.style.height = `${cropHeight}px`
  try {
    await ensureCaptureLayoutReady(signal, options?.onProgress)
    throwIfAborted(signal)
    await prefetchCaptureImageCacheFromLive(liveSurface, signal)
    throwIfAborted(signal)
    assertCaptureSurfaceReady(liveSurface)

    const { disposable, cleanup } = buildDisposableCaptureSurface(liveSurface, outputSize)
    try {
      await delay(200, signal)
      throwIfAborted(signal)
      return await exportCoverBlob(disposable, outputSize, signal, options)
    } finally {
      cleanup()
    }
  } finally {
    liveSurface.style.height = `${cropHeight}px`
  }
}

/** 页面上已打开的 README 正文根节点（排除离屏截图 host） */
export function findReadmeCaptureRoot(fullName: string): HTMLElement | null {
  const escaped = fullName.trim()
  if (!escaped) {
    return null
  }
  const nodes = document.querySelectorAll<HTMLElement>(
    `[${README_CAPTURE_ROOT_ATTR}][${README_CAPTURE_FULL_NAME_ATTR}="${CSS.escape(escaped)}"]`
  )
  for (const node of nodes) {
    if (node.closest('[aria-hidden="true"]')) {
      continue
    }
    if (node.getBoundingClientRect().width > 0) {
      return node
    }
  }
  return null
}

/** 从资料库 README 标签已渲染的 DOM 顶部裁切（与标签页所见一致） */
export async function captureReadmeCoverFromElement(
  contentRoot: HTMLElement,
  outputSize: CoverOutputSize,
  signal?: AbortSignal,
  options?: ExportCoverOptions
): Promise<ReadmeCoverExportResult> {
  const width = contentRoot.clientWidth || README_CAPTURE_SOURCE_WIDTH
  const cropHeight = cropHeightForWidth(width, outputSize)

  const savedScrollTop = contentRoot.scrollTop
  contentRoot.scrollTop = 0

  const surface = document.createElement("div")
  surface.setAttribute("data-readme-cover-surface", "")
  surface.className = "light"
  applyCaptureOffscreenStyles(surface, { width, height: cropHeight })
  surface.style.paddingLeft = `${README_CAPTURE_PADDING_X}px`
  surface.style.paddingRight = `${README_CAPTURE_PADDING_X}px`

  const mirror = contentRoot.cloneNode(true) as HTMLElement
  mirror.style.margin = "0"
  mirror.style.width = "100%"
  mirror.scrollTop = 0
  surface.appendChild(mirror)
  document.body.appendChild(surface)

  try {
    throwIfAborted(signal)
    await delay(200, signal)
    throwIfAborted(signal)
    return await withCaptureTimeout(
      exportCoverBlob(surface, outputSize, signal, options),
      README_CAPTURE_TIMEOUT_MS,
      signal
    )
  } finally {
    contentRoot.scrollTop = savedScrollTop
    surface.remove()
  }
}

export type ReadmeCoverCaptureInput = {
  content: string
  fullName: string
  readmePath?: string | null
  outputSize: CoverOutputSize
  onProgress?: ExportCoverOptions["onProgress"]
}

/** 限制 markdown 体积；不做语义截断，由 3:4 画布 overflow 裁切首屏。 */
export function prepareReadmeCoverMarkdown(content: string): string {
  return truncateReadmeHeroMarkdown(content)
}

/** 不含输出尺寸，用于同 README 仅换比例时复用离屏 DOM */
export function buildCaptureContentKey(input: ReadmeCoverCaptureInput): string {
  const markdown = prepareReadmeCoverMarkdown(input.content)
  return `${input.fullName.trim()}::${input.readmePath ?? ""}::${markdown.length}::${markdown.slice(0, 256)}`
}

export function buildCaptureSessionKey(input: ReadmeCoverCaptureInput): string {
  return `${buildCaptureContentKey(input)}::${input.outputSize.width}x${input.outputSize.height}`
}

export { getCaptureImageCacheSize }

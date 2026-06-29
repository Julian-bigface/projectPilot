import {
  forwardRef,
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"

import { MarkdownContent } from "@/components/project/detail/markdown-content"
import {
  buildCaptureContentKey,
  buildCaptureSessionKey,
  captureReadmeCoverFromElement,
  cropHeightForWidth,
  exportCoverBlobFromLiveSurface,
  findReadmeCaptureRoot,
  isCaptureTimeoutError,
  isCaptureIncompleteError,
  prepareReadmeCoverMarkdown,
  README_CAPTURE_LIGHT_BG,
  README_CAPTURE_LIGHT_TEXT,
  README_CAPTURE_PADDING_X,
  README_CAPTURE_SOURCE_WIDTH,
  README_CAPTURE_TIMEOUT_MS,
  README_CAPTURE_TIMEOUT_RESUMED_MS,
  withCaptureTimeout,
  type ReadmeCoverCaptureInput,
  type ReadmeCoverExportResult,
} from "@/lib/readme-cover-capture"
import type { CoverOutputSize } from "@/lib/readme-cover-presets"

export type ReadmeCoverCaptureHostHandle = {
  capture: (
    input: ReadmeCoverCaptureInput,
    signal?: AbortSignal
  ) => Promise<ReadmeCoverExportResult>
}

type CaptureJob = {
  input: ReadmeCoverCaptureInput
  sessionKey: string
  signal?: AbortSignal
  resolve: (result: ReadmeCoverExportResult) => void
  reject: (err: unknown) => void
  warm?: boolean
}

type HostRenderState = {
  contentKey: string
  fullName: string
  readmePath?: string | null
}

const noopCaptureHandler = () => {}

function rejectStaleJob(targetJob: CaptureJob, err: unknown) {
  try {
    targetJob.reject(err)
  } catch {
    /* ignore */
  }
}

function githubUrlFromFullName(fullName: string): string {
  return `https://github.com/${fullName.trim()}`
}

function applySurfaceCropHeight(
  surface: HTMLDivElement | null,
  outputSize: CoverOutputSize,
  sourceWidth = README_CAPTURE_SOURCE_WIDTH
) {
  if (!surface) {
    return
  }
  surface.style.height = `${cropHeightForWidth(sourceWidth, outputSize)}px`
}

function scheduleExportAfterLayout(run: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}

async function captureFromSurface(
  surfaceRef: RefObject<HTMLDivElement | null>,
  jobInput: ReadmeCoverCaptureInput,
  signal?: AbortSignal,
  timeoutMs = README_CAPTURE_TIMEOUT_MS
): Promise<ReadmeCoverExportResult> {
  const surface = surfaceRef.current
  if (!surface) {
    throw new Error("README 渲染失败。")
  }

  applySurfaceCropHeight(surface, jobInput.outputSize)

  return withCaptureTimeout(
    exportCoverBlobFromLiveSurface(surface, jobInput.outputSize, signal, {
      onProgress: jobInput.onProgress,
    }),
    timeoutMs,
    signal
  )
}

const ReadmeCoverCaptureHostInner = forwardRef<ReadmeCoverCaptureHostHandle>(
  function ReadmeCoverCaptureHostInner(_, ref) {
    const [renderState, setRenderState] = useState<HostRenderState | null>(null)
    const jobRef = useRef<CaptureJob | null>(null)
    const pendingExportJobRef = useRef<CaptureJob | null>(null)
    const contentRef = useRef("")
    const outputSizeRef = useRef<CoverOutputSize | null>(null)
    const surfaceRef = useRef<HTMLDivElement>(null)
    const renderStateRef = useRef<HostRenderState | null>(null)
    const width = README_CAPTURE_SOURCE_WIDTH

    const syncJobRef = (next: CaptureJob | null) => {
      jobRef.current = next
      if (next) {
        outputSizeRef.current = next.input.outputSize
      }
    }

    const parkWarmIdleJob = (targetJob: CaptureJob) => {
      const idleJob: CaptureJob = {
        ...targetJob,
        warm: true,
        resolve: noopCaptureHandler,
        reject: noopCaptureHandler,
      }
      syncJobRef(idleJob)
    }

    const clearJob = () => {
      syncJobRef(null)
      pendingExportJobRef.current = null
      contentRef.current = ""
      outputSizeRef.current = null
      renderStateRef.current = null
      setRenderState(null)
    }

    const ensureRenderState = (
      contentKey: string,
      normalizedInput: ReadmeCoverCaptureInput
    ) => {
      contentRef.current = normalizedInput.content
      outputSizeRef.current = normalizedInput.outputSize
      if (renderStateRef.current?.contentKey !== contentKey) {
        const next: HostRenderState = {
          contentKey,
          fullName: normalizedInput.fullName,
          readmePath: normalizedInput.readmePath,
        }
        renderStateRef.current = next
        setRenderState(next)
      }
      applySurfaceCropHeight(surfaceRef.current, normalizedInput.outputSize)
    }

    const runExportForJob = (targetJob: CaptureJob) => {
      const timeoutMs = targetJob.warm
        ? README_CAPTURE_TIMEOUT_RESUMED_MS
        : README_CAPTURE_TIMEOUT_MS
      void captureFromSurface(
        surfaceRef,
        targetJob.input,
        targetJob.signal,
        timeoutMs
      )
        .then((result) => {
          if (jobRef.current !== targetJob) {
            rejectStaleJob(
              targetJob,
              new DOMException("封面截图已取消", "AbortError")
            )
            return
          }
          targetJob.resolve(result)
          parkWarmIdleJob(targetJob)
        })
        .catch((err) => {
          if (jobRef.current !== targetJob) {
            rejectStaleJob(targetJob, err)
            return
          }
          if (isCaptureTimeoutError(err) || isCaptureIncompleteError(err)) {
            syncJobRef({ ...targetJob, warm: true })
          } else {
            clearJob()
          }
          targetJob.reject(err)
        })
    }

    const queueExportForJob = (targetJob: CaptureJob, needsMarkdownMount: boolean) => {
      if (needsMarkdownMount) {
        pendingExportJobRef.current = targetJob
        return
      }
      scheduleExportAfterLayout(() => {
        if (jobRef.current !== targetJob) {
          return
        }
        runExportForJob(targetJob)
      })
    }

    useImperativeHandle(ref, () => ({
      capture: (input, signal) =>
        new Promise<ReadmeCoverExportResult>((resolve, reject) => {
          const markdown = prepareReadmeCoverMarkdown(input.content)
          if (!markdown.trim()) {
            reject(new Error("README 内容为空，无法生成封面。"))
            return
          }

          const normalizedInput: ReadmeCoverCaptureInput = {
            ...input,
            content: markdown,
          }
          const sessionKey = buildCaptureSessionKey(normalizedInput)
          const contentKey = buildCaptureContentKey(normalizedInput)

          const onAbort = () => {
            reject(new DOMException("封面截图已取消", "AbortError"))
          }
          signal?.addEventListener("abort", onAbort, { once: true })

          const finish = (handler: () => void) => {
            signal?.removeEventListener("abort", onAbort)
            handler()
          }

          const active = jobRef.current
          const activeContentKey = renderStateRef.current?.contentKey
          const canReuseSurface =
            active != null &&
            surfaceRef.current != null &&
            activeContentKey === contentKey &&
            contentRef.current === markdown &&
            (active.warm || active.sessionKey === sessionKey)

          if (canReuseSurface && active) {
            const reuseJob: CaptureJob = {
              input: normalizedInput,
              sessionKey,
              signal,
              warm: true,
              resolve: (result) => finish(() => resolve(result)),
              reject: (err) => finish(() => reject(err)),
            }
            syncJobRef(reuseJob)
            applySurfaceCropHeight(surfaceRef.current, normalizedInput.outputSize)
            scheduleExportAfterLayout(() => {
              if (jobRef.current !== reuseJob) {
                return
              }
              runExportForJob(reuseJob)
            })
            return
          }

          const liveRoot = findReadmeCaptureRoot(input.fullName)
          if (liveRoot?.isConnected) {
            void withCaptureTimeout(
              captureReadmeCoverFromElement(liveRoot, input.outputSize, signal, {
                onProgress: input.onProgress,
              }),
              README_CAPTURE_TIMEOUT_MS,
              signal
            )
              .then((result) => finish(() => resolve(result)))
              .catch((err) => finish(() => reject(err)))
            return
          }

          const nextJob: CaptureJob = {
            input: normalizedInput,
            sessionKey,
            signal,
            resolve: (result) => finish(() => resolve(result)),
            reject: (err) => finish(() => reject(err)),
          }
          syncJobRef(nextJob)
          const needsMarkdownMount = renderStateRef.current?.contentKey !== contentKey
          ensureRenderState(contentKey, normalizedInput)
          queueExportForJob(nextJob, needsMarkdownMount)
        }),
    }))

    useLayoutEffect(() => {
      renderStateRef.current = renderState
      if (!renderState || !outputSizeRef.current) {
        return
      }
      applySurfaceCropHeight(surfaceRef.current, outputSizeRef.current)

      const pending = pendingExportJobRef.current
      if (!pending || pending.warm) {
        return
      }
      pendingExportJobRef.current = null
      scheduleExportAfterLayout(() => {
        if (jobRef.current !== pending) {
          return
        }
        runExportForJob(pending)
      })
    }, [renderState])

    const githubUrl = renderState
      ? githubUrlFromFullName(renderState.fullName)
      : ""

    return (
      <div
        aria-hidden
        className="light bg-background text-foreground pointer-events-none fixed top-0 left-0 z-[-1]"
        style={{ width: README_CAPTURE_SOURCE_WIDTH }}
      >
        <div
          ref={surfaceRef}
          data-readme-cover-surface
          className="overflow-hidden"
          style={{
            width,
            overflow: "hidden",
            boxSizing: "border-box",
            paddingLeft: README_CAPTURE_PADDING_X,
            paddingRight: README_CAPTURE_PADDING_X,
            background: README_CAPTURE_LIGHT_BG,
            color: README_CAPTURE_LIGHT_TEXT,
          }}
        >
          {renderState ? (
            <div className="group/readme-layout relative flex min-h-[12rem] items-start gap-0">
              <div
                data-readme-capture-content
                className="min-w-0 flex-1 outline-none"
              >
                <MarkdownContent
                  content={contentRef.current}
                  githubUrl={githubUrl}
                  readmeBasePath={renderState.readmePath}
                  enableHeadingAnchors={false}
                  enableHtml
                  imageLoading="eager"
                  imageViaProxy
                  hideImageErrors
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }
)

export const ReadmeCoverCaptureHost = memo(ReadmeCoverCaptureHostInner)

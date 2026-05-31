import { useCallback, useMemo, useState, type HTMLAttributes, type ReactElement, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import type { PluggableList } from "unified"
import { ImageOff, RotateCw } from "lucide-react"

import { createHeadingIdAssigner, README_HEADING_ATTR } from "@/lib/markdown-toc"
import { openExternalUrl, isDesktopShell } from "@/lib/open-external-url"
import { resolveReadmeRepoPath } from "@/lib/readme-link-resolve"
import { resolveReadmeImageSrc } from "@/lib/readme-media-resolve"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const baseSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    p: [...(defaultSchema.attributes?.p ?? []), "align"],
    div: [...(defaultSchema.attributes?.div ?? []), "align"],
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "align", "loading"],
    h1: [...(defaultSchema.attributes?.h1 ?? []), "id", README_HEADING_ATTR, "align"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id", README_HEADING_ATTR],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id", README_HEADING_ATTR],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "id", README_HEADING_ATTR],
    h5: [...(defaultSchema.attributes?.h5 ?? []), "id", README_HEADING_ATTR],
    h6: [...(defaultSchema.attributes?.h6 ?? []), "id", README_HEADING_ATTR],
  },
}

const rehypePluginsWithHtml: PluggableList = [rehypeRaw, [rehypeSanitize, baseSanitizeSchema]]
const rehypePluginsPlain: PluggableList = [[rehypeSanitize, baseSanitizeSchema]]

const markdownClassName = cn(
  "max-w-none text-sm leading-relaxed",
  "[&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:scroll-mt-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:scroll-mt-6 [&_h2]:text-xl [&_h2]:font-semibold",
  "[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:scroll-mt-6 [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_h4]:scroll-mt-6 [&_h5]:scroll-mt-6 [&_h6]:scroll-mt-6",
  "[&_p]:mb-4 [&_p]:text-foreground/90",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:mb-1",
  "[&_blockquote]:border-border [&_blockquote]:text-muted-foreground [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:pl-4",
  "[&_pre]:bg-muted/60 [&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4",
  "[&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_pre_code]:bg-transparent",
  "[&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse",
  "[&_th]:border-border [&_th]:border [&_th]:bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left",
  "[&_td]:border-border [&_td]:border [&_td]:px-3 [&_td]:py-2",
  /* 正文大图保持块级；Tailwind preflight 默认 img{display:block} 会把徽章竖排 */
  "[&_img]:max-w-full [&_img]:rounded-md",
  "[&_p>img]:my-4 [&_p>img]:block",
  "[&_a:has(>img)]:mr-1.5 [&_a:has(>img)]:inline-block [&_a:has(>img)]:align-middle",
  "[&_a>img]:my-0 [&_a>img]:mr-0 [&_a>img]:inline-block [&_a>img]:max-h-5 [&_a>img]:w-auto [&_a>img]:align-middle",
  "[&_h1_img]:my-0 [&_h1_img]:inline-block [&_h1_img]:max-h-5 [&_h1_img]:align-middle",
  "[&_h2_img]:my-0 [&_h2_img]:inline-block [&_h2_img]:max-h-5 [&_h2_img]:align-middle",
  "[&_h3_img]:my-0 [&_h3_img]:inline-block [&_h3_img]:max-h-5 [&_h3_img]:align-middle",
  "[&_h1:has(img)]:flex [&_h1:has(img)]:flex-wrap [&_h1:has(img)]:items-center [&_h1:has(img)]:gap-x-2 [&_h1:has(img)]:gap-y-1",
  "[&_h1:has(img)>br]:hidden",
  "[&_p:has(img)]:flex [&_p:has(img)]:flex-wrap [&_p:has(img)]:items-center [&_p:has(img)]:justify-center [&_p:has(img)]:gap-x-2 [&_p:has(img)]:gap-y-1",
  "[&_p:has(img)>br]:hidden",
  "[&_h1[align=center]]:text-center [&_h1[align=center]:has(img)]:justify-center",
  "[&_h2[align=center]]:text-center [&_p[align=center]]:text-center",
  "[&_hr]:border-border [&_hr]:my-8"
)

function flattenMarkdownText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(flattenMarkdownText).join("")
  if (typeof node === "object" && "props" in node) {
    return flattenMarkdownText((node as ReactElement<{ children?: ReactNode }>).props.children)
  }
  return ""
}

function ReadmeMarkdownImage({
  src,
  alt,
  githubUrl,
  readmeBasePath,
}: {
  src?: string
  alt?: string
  githubUrl?: string
  readmeBasePath?: string | null
}) {
  const resolvedSrc = useMemo(
    () => resolveReadmeImageSrc(src, githubUrl, readmeBasePath),
    [src, githubUrl, readmeBasePath]
  )
  const [retryKey, setRetryKey] = useState(0)
  const [failed, setFailed] = useState(false)

  const handleRetry = useCallback(() => {
    setFailed(false)
    setRetryKey((k) => k + 1)
  }, [])

  if (!resolvedSrc) return null

  if (failed) {
    return (
      <div className="border-border bg-muted/30 my-4 flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
        <ImageOff className="text-muted-foreground size-8" aria-hidden />
        <p className="text-muted-foreground text-xs">图片加载失败</p>
        {alt ? <p className="text-muted-foreground max-w-full truncate text-xs">{alt}</p> : null}
        <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
          <RotateCw className="size-3.5" aria-hidden />
          重试
        </Button>
      </div>
    )
  }

  return (
    <img
      key={retryKey}
      src={resolvedSrc}
      alt={alt ?? ""}
      loading="lazy"
      className="inline-block max-w-full align-middle rounded-md"
      onError={() => setFailed(true)}
    />
  )
}

export type MarkdownContentProps = {
  content: string
  githubUrl?: string
  readmeBasePath?: string | null
  onReadmeNavigate?: (path: string) => void
  enableHeadingAnchors?: boolean
  /** 允许 README 内嵌 HTML（rehype-raw）；Release 等场景保持 false。 */
  enableHtml?: boolean
}

export function MarkdownContent({
  content,
  githubUrl,
  readmeBasePath = null,
  onReadmeNavigate,
  enableHeadingAnchors = true,
  enableHtml = false,
}: MarkdownContentProps) {
  const enableReadmeNav = Boolean(githubUrl && onReadmeNavigate)
  const headingIdAssigner = useMemo(() => createHeadingIdAssigner(), [content])
  headingIdAssigner.reset()

  const rehypePlugins = enableHtml ? rehypePluginsWithHtml : rehypePluginsPlain

  const makeHeading =
    (tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") =>
    ({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) => {
      const Tag = tag
      if (!enableHeadingAnchors) {
        return <Tag {...props}>{children}</Tag>
      }
      const text = flattenMarkdownText(children)
      const id = headingIdAssigner.next(text)
      return (
        <Tag {...props} id={id} {...{ [README_HEADING_ATTR]: id }}>
          {children}
        </Tag>
      )
    }

  const headingComponents = enableHeadingAnchors
    ? {
        h1: makeHeading("h1"),
        h2: makeHeading("h2"),
        h3: makeHeading("h3"),
        h4: makeHeading("h4"),
        h5: makeHeading("h5"),
        h6: makeHeading("h6"),
      }
    : {}

  const imgComponent = githubUrl
    ? ({ src, alt }: { src?: string; alt?: string }) => (
        <ReadmeMarkdownImage
          src={src}
          alt={alt}
          githubUrl={githubUrl}
          readmeBasePath={readmeBasePath}
        />
      )
    : undefined

  return (
    <div className={markdownClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          ...headingComponents,
          ...(imgComponent ? { img: imgComponent } : {}),
          a: ({ href, children, ...props }) => {
            const repoPath =
              enableReadmeNav && githubUrl
                ? resolveReadmeRepoPath(href, readmeBasePath, githubUrl)
                : null
            if (repoPath) {
              return (
                <a
                  href={href}
                  {...props}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    onReadmeNavigate?.(repoPath)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                {...props}
                onClick={(e) => {
                  props.onClick?.(e)
                  if (e.defaultPrevented || !href || !isDesktopShell()) return
                  e.preventDefault()
                  void openExternalUrl(href)
                }}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

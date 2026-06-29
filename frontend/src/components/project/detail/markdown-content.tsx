import { useCallback, useMemo, useState, type HTMLAttributes, type ReactElement, type ReactNode, type SourceHTMLAttributes } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import type { PluggableList } from "unified"
import { ImageOff, RotateCw } from "lucide-react"

import { createHeadingIdAssigner, README_HEADING_ATTR } from "@/lib/markdown-toc"
import { openExternalUrl, isDesktopShell } from "@/lib/open-external-url"
import { isReadmeBadgeImage, isReadmeHeroBadgeImage } from "@/lib/readme-image-kind"
import { resolveReadmeRepoPath } from "@/lib/readme-link-resolve"
import { resolveReadmeImageSrc, resolveReadmeSrcSet } from "@/lib/readme-media-resolve"
import { wrapCrossOriginReadmeImage } from "@/lib/readme-image-proxy"
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
    source: [...(defaultSchema.attributes?.source ?? []), "media"],
    h1: [...(defaultSchema.attributes?.h1 ?? []), "id", README_HEADING_ATTR, "align"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id", README_HEADING_ATTR, "align"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id", README_HEADING_ATTR, "align"],
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
  /* 正文大图保持块级；徽章（shields 等）保持行内小图 */
  "[&_img]:max-w-full [&_img]:rounded-md",
  "[&_.readme-img-badge]:my-0 [&_.readme-img-badge]:inline-block [&_.readme-img-badge]:max-h-5 [&_.readme-img-badge]:w-auto [&_.readme-img-badge]:align-middle",
  "[&_.readme-img-content]:my-4 [&_.readme-img-content]:block [&_.readme-img-content]:max-w-full",
  "[&_.readme-img-hero]:my-2 [&_.readme-img-hero]:block [&_.readme-img-hero]:max-w-full [&_.readme-img-hero]:w-auto",
  "[&_[align=center]_.readme-img-content]:mx-auto [&_[align=center]_.readme-img-hero]:mx-auto",
  "[&_img.readme-img-content[align=center]]:mx-auto [&_img.readme-img-hero[align=center]]:mx-auto",
  "[&_a:has(>.readme-img-badge)]:inline-block [&_a:has(>.readme-img-badge)]:align-middle",
  "[&_a:has(>.readme-img-content)]:block [&_[align=center]_a:has(>.readme-img-content)]:mx-auto",
  "[&_a:has(>.readme-img-hero)]:block [&_a:has(>.readme-img-hero)]:w-fit [&_[align=center]_a:has(>.readme-img-hero)]:mx-auto",
  "[&_h1>a:has(>.readme-img-content)]:mx-auto [&_h1>a:has(>.readme-img-content)]:block [&_h1>a:has(>.readme-img-content)]:w-fit",
  "[&_div[align=center]]:text-center",
  "[&_div[align=center]_h1]:text-center [&_div[align=center]_h2]:text-center [&_div[align=center]_h3]:text-center [&_div[align=center]_p]:text-center",
  "[&_h1:has(.readme-img-badge)]:flex [&_h1:has(.readme-img-badge)]:flex-wrap [&_h1:has(.readme-img-badge)]:items-center [&_h1:has(.readme-img-badge)]:justify-center [&_h1:has(.readme-img-badge)]:gap-x-1.5 [&_h1:has(.readme-img-badge)]:gap-y-1",
  "[&_h1:has(.readme-img-badge)>br]:hidden",
  "[&_p:has(.readme-img-badge):not(:has(.readme-img-hero))]:flex [&_p:has(.readme-img-badge):not(:has(.readme-img-hero))]:flex-wrap [&_p:has(.readme-img-badge):not(:has(.readme-img-hero))]:items-center [&_p:has(.readme-img-badge):not(:has(.readme-img-hero))]:justify-center [&_p:has(.readme-img-badge):not(:has(.readme-img-hero))]:gap-x-1.5 [&_p:has(.readme-img-badge):not(:has(.readme-img-hero))]:gap-y-1",
  "[&_p:has(.readme-img-badge):not(:has(.readme-img-hero))>br]:hidden",
  "[&_p:has(.readme-img-hero)]:flex [&_p:has(.readme-img-hero)]:flex-col [&_p:has(.readme-img-hero)]:items-center [&_p:has(.readme-img-hero)]:justify-center [&_p:has(.readme-img-hero)]:gap-y-2",
  "[&_p:has(.readme-img-hero)>br]:hidden",
  "[&_h1[align=center]]:text-center [&_h1[align=center]:has(.readme-img-badge)]:justify-center",
  "[&_h2[align=center]]:text-center [&_h3[align=center]]:text-center",
  "[&_p[align=center]]:text-center",
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
  loading = "lazy",
  crossOrigin,
  imageViaProxy = false,
  hideOnError = false,
}: {
  src?: string
  alt?: string
  githubUrl?: string
  readmeBasePath?: string | null
  loading?: "lazy" | "eager"
  crossOrigin?: "anonymous"
  /** 封面截图：外链图走同源代理，避免 canvas 跨域 */
  imageViaProxy?: boolean
  /** 封面截图等场景：加载失败时不展示占位卡片 */
  hideOnError?: boolean
}) {
  const resolvedSrc = useMemo(() => {
    const base = resolveReadmeImageSrc(src, githubUrl, readmeBasePath)
    if (!base) {
      return base
    }
    return imageViaProxy ? wrapCrossOriginReadmeImage(base) : base
  }, [src, githubUrl, readmeBasePath, imageViaProxy])
  const [retryKey, setRetryKey] = useState(0)
  const [failed, setFailed] = useState(false)

  const handleRetry = useCallback(() => {
    setFailed(false)
    setRetryKey((k) => k + 1)
  }, [])

  if (!resolvedSrc) return null

  const isHero = isReadmeHeroBadgeImage(src)
  const isBadge = !isHero && isReadmeBadgeImage(src, alt)

  if (failed) {
    if (hideOnError) {
      return null
    }
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
      loading={loading}
      crossOrigin={crossOrigin}
      className={cn(
        "max-w-full rounded-md align-middle",
        isBadge ? "readme-img-badge" : isHero ? "readme-img-hero" : "readme-img-content"
      )}
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
  imageLoading?: "lazy" | "eager"
  imageCrossOrigin?: "anonymous"
  /** 封面截图：外链图经 /api/projects/readme-image-proxy 同源加载 */
  imageViaProxy?: boolean
  hideImageErrors?: boolean
}

export function MarkdownContent({
  content,
  githubUrl,
  readmeBasePath = null,
  onReadmeNavigate,
  enableHeadingAnchors = true,
  enableHtml = false,
  imageLoading = "lazy",
  imageCrossOrigin,
  imageViaProxy = false,
  hideImageErrors = false,
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
          loading={imageLoading}
          crossOrigin={imageCrossOrigin}
          imageViaProxy={imageViaProxy}
          hideOnError={hideImageErrors}
        />
      )
    : undefined

  const sourceComponent = githubUrl
    ? ({
        srcSet,
        srcset,
        media,
        ...props
      }: SourceHTMLAttributes<HTMLSourceElement> & { srcset?: string }) => (
        <source
          {...props}
          media={media}
          srcSet={resolveReadmeSrcSet(srcSet ?? srcset, githubUrl, readmeBasePath)}
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
          ...(sourceComponent ? { source: sourceComponent } : {}),
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

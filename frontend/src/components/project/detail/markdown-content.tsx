import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

import { cn } from "@/lib/utils"

const markdownClassName = cn(
  "max-w-none text-sm leading-relaxed",
  "[&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-semibold",
  "[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold",
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
  "[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-md",
  "[&_hr]:border-border [&_hr]:my-8"
)

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className={markdownClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

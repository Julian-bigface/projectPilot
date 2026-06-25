export function PromotionHighlightTags({
  tags,
  onTagClick,
}: {
  tags: string[]
  onTagClick?: (tag: string) => void
}) {
  if (tags.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">亮点标签（可选）</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer rounded-md px-2 py-0.5 text-xs"
            onClick={() => onTagClick?.(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}

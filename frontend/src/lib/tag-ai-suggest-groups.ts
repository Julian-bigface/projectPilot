import type { TagCategory } from "@/types/tag"
import type { TagCategoryProposal } from "@/types/tag-ai"

export type EditableProposal = TagCategoryProposal & {
  selectedCategoryId: number | null
  selectedNewCategoryName: string | null
}

export type TagSuggestionGroup = {
  key: string
  categoryId: number | null
  newCategoryName: string | null
  displayName: string
  tags: EditableProposal[]
}

export function proposalToEditable(p: TagCategoryProposal): EditableProposal {
  return {
    ...p,
    selectedCategoryId: p.category_id,
    selectedNewCategoryName: p.new_category_name,
  }
}

export function getProposalGroupKey(row: EditableProposal): string {
  if (row.selectedCategoryId != null) {
    return `cat:${row.selectedCategoryId}`
  }
  const newName = row.selectedNewCategoryName?.trim()
  if (newName) {
    return `new:${newName.toLowerCase()}`
  }
  return `unknown:${row.tag_id}`
}

export function getProposalDisplayName(
  row: EditableProposal,
  categories: TagCategory[]
): string {
  if (row.selectedCategoryId != null) {
    return categories.find((c) => c.id === row.selectedCategoryId)?.name ?? "未知分类"
  }
  return row.selectedNewCategoryName?.trim() || "未指定"
}

export function groupProposals(
  rows: EditableProposal[],
  categories: TagCategory[]
): TagSuggestionGroup[] {
  const map = new Map<string, TagSuggestionGroup>()

  for (const row of rows) {
    const key = getProposalGroupKey(row)
    const existing = map.get(key)
    if (existing) {
      existing.tags.push(row)
      continue
    }
    map.set(key, {
      key,
      categoryId: row.selectedCategoryId,
      newCategoryName: row.selectedNewCategoryName?.trim() || null,
      displayName: getProposalDisplayName(row, categories),
      tags: [row],
    })
  }

  return [...map.values()].sort((a, b) => {
    if (b.tags.length !== a.tags.length) {
      return b.tags.length - a.tags.length
    }
    return a.displayName.localeCompare(b.displayName, "zh-CN")
  })
}

export function formatTagPreview(tags: EditableProposal[], maxNames = 3): string {
  const names = tags.slice(0, maxNames).map((t) => t.tag_name)
  if (tags.length <= maxNames) {
    return names.join("、")
  }
  return `${names.join("、")} 等 ${tags.length} 个标签`
}

export function proposalsToApplyItems(rows: EditableProposal[]) {
  return rows.map((r) => {
    if (r.selectedCategoryId != null) {
      return { tag_id: r.tag_id, category_id: r.selectedCategoryId }
    }
    if (r.selectedNewCategoryName?.trim()) {
      return {
        tag_id: r.tag_id,
        category_id: null,
        new_category_name: r.selectedNewCategoryName.trim(),
      }
    }
    return {
      tag_id: r.tag_id,
      category_id: r.category_id,
      new_category_name: r.new_category_name,
    }
  })
}

export function defaultSelected(confidence: TagCategoryProposal["confidence"]): boolean {
  return confidence === "high"
}

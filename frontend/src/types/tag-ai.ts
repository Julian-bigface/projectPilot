export type TagCategoryProposal = {
  tag_id: number
  tag_name: string
  category_id: number | null
  new_category_name: string | null
  confidence: "high" | "medium" | "low"
  reason: string | null
}

export type TagCategorySuggestResponse = {
  proposals: TagCategoryProposal[]
  batches: number
  skipped_tag_ids: number[]
}

export type TagCategorySuggestRequest = {
  tag_ids?: number[]
  include_new_categories?: boolean
}

export type TagCategoryApplyItem = {
  tag_id: number
  category_id: number | null
  new_category_name?: string | null
}

export type TagCategorySuggestStreamEvent =
  | { event: "start"; total_batches: number; total_tags: number }
  | {
      event: "batch_start"
      batch_index: number
      total_batches: number
      tag_count: number
    }
  | {
      event: "batch"
      batch_index: number
      total_batches: number
      proposals: TagCategoryProposal[]
      skipped_tag_ids: number[]
    }
  | {
      event: "done"
      batches: number
      skipped_tag_ids: number[]
      proposal_count: number
    }
  | { event: "error"; detail: string }

export type TagCategoryApplyResponse = {
  applied: number
  categories_created: number
  skipped: number
  errors: string[]
}

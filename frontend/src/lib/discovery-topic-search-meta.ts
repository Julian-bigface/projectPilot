import type { DiscoveryTopicSearchMeta } from "@/types/discovery"

export function formatDiscoveryTopicSearchMeta(meta: DiscoveryTopicSearchMeta | null | undefined): string | null {
  if (!meta || meta.terms.length === 0) {
    if (meta?.mode === "bilingual" && meta.translation_failed) {
      return "已按中文关键词搜索（翻译暂不可用）"
    }
    return null
  }

  const termsLabel = meta.terms.join("、")

  if (meta.mode === "category" && meta.category_name) {
    return `已按分类「${meta.category_name}」扩展为：${termsLabel}`
  }

  if (meta.mode === "bilingual") {
    if (meta.translation_failed) {
      return `已按中文搜索：${termsLabel}`
    }
    const en = meta.translated?.trim()
    return en && en !== meta.terms[0]
      ? `已同时搜索中文与英文：${termsLabel}`
      : `已同时搜索中文与英文：${termsLabel}`
  }

  return null
}

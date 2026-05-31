/** 项目库作用域下的 API 路径前缀 */

export function plApiBase(libraryId: number | string): string {
  return `/api/project-libraries/${libraryId}`
}

export function plApiPath(libraryId: number | string, suffix: string): string {
  const base = plApiBase(libraryId)
  if (!suffix) {
    return base
  }
  return suffix.startsWith("/") ? `${base}${suffix}` : `${base}/${suffix}`
}

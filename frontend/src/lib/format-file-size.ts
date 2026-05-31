const UNITS = ["B", "KB", "MB", "GB", "TB"] as const

/** 1024 进制，保留 1 位小数（如 136.4 MB）。 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return "—"
  }
  if (bytes === 0) {
    return "0 B"
  }
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  const formatted = value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${formatted} ${UNITS[exponent]}`
}

/** 将 GitHub API ISO 时间格式化为相对时间（中文）。 */
export function formatGithubPushedRelative(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "—"
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  const ms = date.getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" })

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day

  const abs = Math.abs(ms)
  if (abs < minute) {
    return rtf.format(Math.round(ms / 1000), "second")
  }
  if (abs < hour) {
    return rtf.format(Math.round(ms / minute), "minute")
  }
  if (abs < day) {
    return rtf.format(Math.round(ms / hour), "hour")
  }
  if (abs < week) {
    return rtf.format(Math.round(ms / day), "day")
  }
  if (abs < month) {
    return rtf.format(Math.round(ms / week), "week")
  }
  if (abs < year) {
    return rtf.format(Math.round(ms / month), "month")
  }
  return rtf.format(Math.round(ms / year), "year")
}

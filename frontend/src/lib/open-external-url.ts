/** 是否在 Tauri 桌面壳内运行（生产 sidecar 或 dev WebView）。 */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window
}

/** 在桌面壳内用系统默认浏览器打开 URL；浏览器开发态走 window.open。 */
export async function openExternalUrl(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) return

  if (isDesktopShell()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener")
    await openUrl(trimmed)
    return
  }

  window.open(trimmed, "_blank", "noopener,noreferrer")
}

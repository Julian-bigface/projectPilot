/** 是否在 Tauri 桌面壳内运行（生产 sidecar 或 dev WebView）。 */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false
  if ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) return true
  // 生产态 WebView 加载 http://127.0.0.1:38472/，需配合 capabilities remote.urls 注入 Tauri API
  try {
    const { hostname, port } = window.location
    if (port === "38472" && (hostname === "127.0.0.1" || hostname === "localhost")) {
      return true
    }
  } catch {
    // ignore
  }
  return false
}

/** 在桌面壳内用系统默认浏览器打开 URL；浏览器开发态走 window.open。 */
export async function openExternalUrl(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) return

  if (isDesktopShell()) {
    // sidecar 生产态 (127.0.0.1:38472) 上 Tauri IPC 可能不可用；触发 WebView 导航，
    // 由 Rust on_navigation / on_new_window 拦截并用系统浏览器打开。
    if (
      typeof window !== "undefined" &&
      window.location.port === "38472" &&
      (window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "localhost")
    ) {
      window.location.href = trimmed
      return
    }

    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener")
      await openUrl(trimmed)
    } catch (err) {
      console.error("[openExternalUrl] openUrl failed, fallback navigation:", err)
      window.location.href = trimmed
    }
    return
  }

  window.open(trimmed, "_blank", "noopener,noreferrer")
}

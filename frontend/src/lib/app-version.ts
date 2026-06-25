/** 构建时由 scripts/sync-frontend-to-tauri-resources.ps1 注入；开发态 fallback 见 vite.config.ts */

export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev"
export const APP_BUILD_TIME = import.meta.env.VITE_APP_BUILD_TIME ?? ""

export function formatAppVersionLabel(): string {
  if (APP_BUILD_TIME) {
    return `Project Pilot v${APP_VERSION} (${APP_BUILD_TIME})`
  }
  return `Project Pilot v${APP_VERSION}`
}

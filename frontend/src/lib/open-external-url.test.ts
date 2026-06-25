import { afterEach, describe, expect, it, vi } from "vitest"

import { isDesktopShell, openExternalUrl } from "./open-external-url"

describe("isDesktopShell", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns false in a normal browser context", () => {
    expect(isDesktopShell()).toBe(false)
  })

  it("returns true when Tauri internals are present", () => {
    vi.stubGlobal("window", {
      __TAURI_INTERNALS__: {},
      location: { hostname: "127.0.0.1", port: "38472" },
    })
    expect(isDesktopShell()).toBe(true)
  })

  it("returns true on production sidecar origin", () => {
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", port: "38472" },
    })
    expect(isDesktopShell()).toBe(true)
  })
})

describe("openExternalUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("opens via window.open in browser mode", async () => {
    const open = vi.fn()
    vi.stubGlobal("window", { open, location: { hostname: "localhost", port: "5173" } })
    await openExternalUrl("https://github.com/foo/bar")
    expect(open).toHaveBeenCalledWith("https://github.com/foo/bar", "_blank", "noopener,noreferrer")
  })

  it("uses location.href on production sidecar origin", async () => {
    const location = { hostname: "127.0.0.1", port: "38472", href: "" }
    vi.stubGlobal("window", { location })
    await openExternalUrl("https://github.com/foo/bar")
    expect(location.href).toBe("https://github.com/foo/bar")
  })

  it("ignores empty urls", async () => {
    const open = vi.fn()
    vi.stubGlobal("window", { open })
    await openExternalUrl("   ")
    expect(open).not.toHaveBeenCalled()
  })
})

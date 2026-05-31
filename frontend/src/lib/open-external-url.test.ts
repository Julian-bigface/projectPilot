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
    vi.stubGlobal("window", { open })
    await openExternalUrl("https://github.com/foo/bar")
    expect(open).toHaveBeenCalledWith("https://github.com/foo/bar", "_blank", "noopener,noreferrer")
  })

  it("ignores empty urls", async () => {
    const open = vi.fn()
    vi.stubGlobal("window", { open })
    await openExternalUrl("   ")
    expect(open).not.toHaveBeenCalled()
  })
})

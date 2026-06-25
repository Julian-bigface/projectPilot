import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildDisposableCaptureSurface,
  README_CAPTURE_CONTENT_ATTR,
  stripBelowFoldImages,
} from "@/lib/readme-cover-capture"
import { getCoverOutputSize } from "@/lib/readme-cover-presets"

type MockEl = {
  tagName: string
  style: Record<string, string>
  attributes: Record<string, string>
  children: MockEl[]
  parent: MockEl | null
  clientWidth: number
  clientHeight: number
  scrollTop: number
  appendChild: (child: MockEl) => void
  cloneNode: (deep?: boolean) => MockEl
  remove: () => void
  querySelectorAll: (selector: string) => MockEl[]
  setAttribute: (name: string, value: string) => void
  getAttribute: (name: string) => string | null
  getBoundingClientRect: () => { top: number; height: number; width: number }
  replaceWith: (next: MockEl) => void
  querySelector: (selector: string) => MockEl | null
  firstElementChild?: MockEl | null
}

function createMockElement(tag: string, doc: { body: MockEl }): MockEl {
  const el: MockEl = {
    tagName: tag.toUpperCase(),
    style: {},
    attributes: {},
    children: [],
    parent: null,
    clientWidth: 640,
    clientHeight: 400,
    scrollTop: 0,
    appendChild(child) {
      child.parent = this
      this.children.push(child)
    },
    cloneNode(deep = false) {
      const copy = createMockElement(tag, doc)
      copy.style = { ...this.style }
      copy.attributes = { ...this.attributes }
      copy.clientWidth = this.clientWidth
      copy.clientHeight = this.clientHeight
      if (deep) {
        for (const child of this.children) {
          copy.appendChild(child.cloneNode(true))
        }
      }
      return copy
    },
    remove() {
      if (!this.parent) {
        return
      }
      this.parent.children = this.parent.children.filter((child) => child !== this)
      this.parent = null
    },
    querySelectorAll(selector: string) {
      const out: MockEl[] = []
      const walk = (node: MockEl) => {
        if (selector === "img" && node.tagName === "IMG") {
          out.push(node)
        }
        if (selector === "picture" && node.tagName === "PICTURE") {
          out.push(node)
        }
        for (const child of node.children) {
          walk(child)
        }
      }
      walk(this)
      return out
    },
    querySelector(selector: string) {
      if (selector.includes(README_CAPTURE_CONTENT_ATTR)) {
        return this.children[0] ?? null
      }
      if (selector.includes("readme-layout")) {
        return this.children[0] ?? null
      }
      return this.querySelectorAll(selector)[0] ?? null
    },
    setAttribute(name, value) {
      this.attributes[name] = value
    },
    getAttribute(name) {
      return this.attributes[name] ?? null
    },
    getBoundingClientRect() {
      const top = Number(this.attributes["data-top"] ?? 0)
      const height = Number(this.attributes["data-height"] ?? 120)
      return { top, height, width: this.clientWidth }
    },
    replaceWith(next) {
      if (!this.parent) {
        return
      }
      const index = this.parent.children.indexOf(this)
      if (index >= 0) {
        this.parent.children.splice(index, 1, next)
        next.parent = this.parent
      }
      this.parent = null
    },
  }
  Object.defineProperty(el, "firstElementChild", {
    get() {
      return el.children[0] ?? null
    },
  })
  return el
}

function installMockDocument() {
  const body = createMockElement("body", { body: null as unknown as MockEl })
  body.parent = null
  const doc = {
    body,
    createElement: (tag: string) => createMockElement(tag, doc as unknown as { body: MockEl }),
  }
  vi.stubGlobal("document", doc)
  return doc
}

function countImgs(root: MockEl): number {
  return root.querySelectorAll("img").length
}

describe("readme-cover-capture clone", () => {
  beforeEach(() => {
    installMockDocument()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("buildDisposableCaptureSurface does not remove live images", () => {
    const live = document.createElement("div") as unknown as MockEl
    live.clientWidth = 640
    const layout = document.createElement("div") as unknown as MockEl
    layout.setAttribute(README_CAPTURE_CONTENT_ATTR, "")
    const imgA = document.createElement("img") as unknown as MockEl
    const imgB = document.createElement("img") as unknown as MockEl
    imgB.setAttribute("data-top", "500")
    layout.appendChild(imgA)
    layout.appendChild(imgB)
    live.appendChild(layout)
    ;(document.body as unknown as MockEl).appendChild(live)

    const before = countImgs(live)
    const outputSize = getCoverOutputSize("xiaohongshu-34")
    const { disposable, cleanup } = buildDisposableCaptureSurface(
      live as unknown as HTMLElement,
      outputSize
    )

    expect(countImgs(live)).toBe(before)
    expect(countImgs(disposable as unknown as MockEl)).toBe(before)
    expect(disposable.getAttribute("data-readme-cover-clone")).toBe("")
    cleanup()
    expect((document.body as unknown as MockEl).children).not.toContain(
      disposable as unknown as MockEl
    )
  })

  it("stripBelowFoldImages only mutates the target root", () => {
    const live = document.createElement("div") as unknown as MockEl
    const disposable = document.createElement("div") as unknown as MockEl
    live.clientHeight = 400
    disposable.clientHeight = 400

    const liveImg = document.createElement("img") as unknown as MockEl
    liveImg.setAttribute("data-top", "0")
    const liveBelow = document.createElement("img") as unknown as MockEl
    liveBelow.setAttribute("data-top", "500")
    live.appendChild(liveImg)
    live.appendChild(liveBelow)

    const cloneImg = document.createElement("img") as unknown as MockEl
    cloneImg.setAttribute("data-top", "0")
    const cloneBelow = document.createElement("img") as unknown as MockEl
    cloneBelow.setAttribute("data-top", "500")
    disposable.appendChild(cloneImg)
    disposable.appendChild(cloneBelow)

    stripBelowFoldImages(
      disposable as unknown as HTMLElement,
      disposable as unknown as HTMLElement
    )

    expect(countImgs(live)).toBe(2)
    expect(countImgs(disposable)).toBe(1)
  })
})

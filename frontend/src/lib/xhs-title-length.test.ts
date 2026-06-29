import { describe, expect, it } from "vitest"

import { countXhsTitleUnits, isXhsTitleOverLimit } from "./xhs-title-length"

describe("countXhsTitleUnits", () => {
  it("counts each Chinese character as one unit", () => {
    expect(countXhsTitleUnits("一条命令上线网站")).toBe(8)
    expect(countXhsTitleUnits("部署焦虑症患者的救星来了")).toBe(12)
  })

  it("counts ASCII letters as two per unit rounded up", () => {
    expect(countXhsTitleUnits("A")).toBe(1)
    expect(countXhsTitleUnits("AB")).toBe(1)
    expect(countXhsTitleUnits("ABC")).toBe(2)
    expect(countXhsTitleUnits("Hello")).toBe(3)
  })

  it("mixes Chinese and English correctly", () => {
    expect(countXhsTitleUnits("你好Hi")).toBe(2 + 1)
    expect(countXhsTitleUnits("AI神器")).toBe(2 + 1)
  })

  it("counts punctuation and digits as one unit each", () => {
    expect(countXhsTitleUnits("！")).toBe(1)
    expect(countXhsTitleUnits("123")).toBe(3)
    expect(countXhsTitleUnits("标题！")).toBe(3)
  })

  it("detects over limit for long Chinese titles", () => {
    const title = "一条命令上线网站！部署焦虑症患者的救星来了"
    expect(countXhsTitleUnits(title)).toBe(21)
    expect(isXhsTitleOverLimit(title)).toBe(true)
  })
})

/** 小红书笔记标题字数上限（按平台计量单位） */
export const XHS_TITLE_LIMIT = 20

const CJK_RE =
  /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/
const ASCII_LETTER_RE = /[a-zA-Z]/

/**
 * 小红书标题字数：中文等全角字符各计 1；连续英文字母每 2 个计 1（不足 2 向上取整）。
 * 数字、标点、空格等其它字符各计 1。
 */
export function countXhsTitleUnits(text: string): number {
  let units = 0
  let pendingAsciiLetters = 0

  const flushAsciiLetters = () => {
    if (pendingAsciiLetters <= 0) {
      return
    }
    units += Math.ceil(pendingAsciiLetters / 2)
    pendingAsciiLetters = 0
  }

  for (const char of text) {
    if (CJK_RE.test(char)) {
      flushAsciiLetters()
      units += 1
    } else if (ASCII_LETTER_RE.test(char)) {
      pendingAsciiLetters += 1
    } else {
      flushAsciiLetters()
      units += 1
    }
  }

  flushAsciiLetters()
  return units
}

export function isXhsTitleOverLimit(text: string, limit = XHS_TITLE_LIMIT): boolean {
  return countXhsTitleUnits(text) > limit
}

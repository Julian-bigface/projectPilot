/** 计算 textarea 内某字符索引处的光标坐标（相对 textarea 内容区，含 scroll 校正）。 */

const MIRROR_PROPS = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const

export function getTextareaCaretOffset(
  textarea: HTMLTextAreaElement,
  position: number
): { top: number; left: number } {
  const mirror = document.createElement("div")
  const computed = window.getComputedStyle(textarea)
  const style = mirror.style

  mirror.setAttribute("aria-hidden", "true")
  style.position = "absolute"
  style.visibility = "hidden"
  style.whiteSpace = "pre-wrap"
  style.wordWrap = "break-word"
  style.overflow = "hidden"

  for (const prop of MIRROR_PROPS) {
    style[prop] = computed[prop]
  }

  style.width = `${textarea.clientWidth}px`

  const before = textarea.value.substring(0, position)

  mirror.textContent = ""
  if (before) {
    mirror.appendChild(document.createTextNode(before))
  }
  const marker = document.createElement("span")
  marker.textContent = "\u200b"
  mirror.appendChild(marker)

  document.body.appendChild(mirror)

  const top =
    marker.offsetTop +
    Number.parseFloat(computed.borderTopWidth) +
    Number.parseFloat(computed.paddingTop) -
    textarea.scrollTop
  const left =
    marker.offsetLeft +
    Number.parseFloat(computed.borderLeftWidth) +
    Number.parseFloat(computed.paddingLeft)

  document.body.removeChild(mirror)

  return { top, left }
}

/** README 封面截图用：经后端代理拉取外链图片，避免 canvas 跨域污染。 */
export function readmeImageProxyUrl(src: string): string {
  return `/api/projects/readme-image-proxy?url=${encodeURIComponent(src)}`
}

const PROXY_PATH = "/api/projects/readme-image-proxy"

export function isReadmeImageProxyUrl(src: string): boolean {
  return src.includes(PROXY_PATH)
}

/** 将跨域 http(s) 图片 URL 转为同源代理地址；已是 data/blob/同源则原样返回。 */
export function wrapCrossOriginReadmeImage(
  src: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1"
): string {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
    return src
  }
  if (isReadmeImageProxyUrl(src)) {
    return src
  }
  try {
    const url = new URL(src, origin)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return src
    }
    if (url.origin === origin) {
      return url.href
    }
    return readmeImageProxyUrl(url.href)
  } catch {
    return src
  }
}

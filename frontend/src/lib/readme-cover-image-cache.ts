const cache = new Map<string, string>()

export function normalizeCaptureImageUrl(src: string): string {
  return src.trim()
}

export function getCachedInlineImage(src: string): string | undefined {
  return cache.get(normalizeCaptureImageUrl(src))
}

export function setCachedInlineImage(src: string, dataUrl: string): void {
  cache.set(normalizeCaptureImageUrl(src), dataUrl)
}

export function getCaptureImageCacheSize(): number {
  return cache.size
}

export function clearCaptureImageCache(): void {
  cache.clear()
}

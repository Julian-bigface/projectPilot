export type CoverOutputSize = {
  width: number
  height: number
}

export type ReadmeCoverSizePreset = CoverOutputSize & {
  id: string
  label: string
  ratio: string
}

/** 默认输出尺寸见 {@link DEFAULT_README_COVER_PRESET_ID} */
export const DEFAULT_README_COVER_PRESET_ID = "xiaohongshu-34"

export const README_COVER_SIZE_PRESETS: ReadmeCoverSizePreset[] = [
  { id: "xiaohongshu-34", label: "小红书", ratio: "3:4", width: 1242, height: 1660 },
  { id: "square-11", label: "方图", ratio: "1:1", width: 1080, height: 1080 },
  { id: "vertical-916", label: "竖屏视频", ratio: "9:16", width: 1080, height: 1920 },
  { id: "portrait-23", label: "竖版", ratio: "2:3", width: 1000, height: 1500 },
  { id: "wide-169", label: "横屏", ratio: "16:9", width: 1920, height: 1080 },
]

const presetById = new Map(README_COVER_SIZE_PRESETS.map((p) => [p.id, p]))

export function getReadmeCoverPreset(id: string): ReadmeCoverSizePreset {
  return presetById.get(id) ?? README_COVER_SIZE_PRESETS[0]
}

export function getCoverOutputSize(presetId: string): CoverOutputSize {
  const { width, height } = getReadmeCoverPreset(presetId)
  return { width, height }
}

export function formatCoverSizeLabel(preset: ReadmeCoverSizePreset): string {
  return `${preset.ratio} · ${preset.width}×${preset.height}`
}

const COVER_SIZE_STORAGE_KEY = "projectPilot.readmeCoverSizePreset"

export function readStoredCoverSizePresetId(): string {
  try {
    const stored = localStorage.getItem(COVER_SIZE_STORAGE_KEY)
    if (stored && presetById.has(stored)) {
      return stored
    }
  } catch {
    // ignore
  }
  return DEFAULT_README_COVER_PRESET_ID
}

export function storeCoverSizePresetId(presetId: string): void {
  try {
    localStorage.setItem(COVER_SIZE_STORAGE_KEY, presetId)
  } catch {
    // ignore
  }
}

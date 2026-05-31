/** Classic PAT（ghp_）常见长度；无数据库记录时（如仅环境变量）的掩码回退长度。 */
export const DEFAULT_GITHUB_PAT_MASK_LENGTH = 40

/** 生成与真实 Token 等长的掩码字符串（password 输入框会按字符数显示圆点）。 */
export function buildSavedGithubTokenMask(tokenLength: number | null | undefined): string {
  const len = tokenLength ?? DEFAULT_GITHUB_PAT_MASK_LENGTH
  return "x".repeat(Math.max(len, 1))
}

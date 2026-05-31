/** Zread AI Wiki（中文场景，与 GithubStarsManager 一致） */
export function zreadProjectUrl(fullName: string): string {
  const trimmed = fullName.trim()
  return `https://zread.ai/${trimmed}`
}

/** DeepWiki（英文场景） */
export function deepWikiProjectUrl(githubUrl: string): string {
  return githubUrl.replace("github.com", "deepwiki.com")
}

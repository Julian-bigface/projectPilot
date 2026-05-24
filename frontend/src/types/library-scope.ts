/** 资料库侧栏导航（bilifish 式：快捷入口 + 文件夹树） */
export type LibraryScope =
  | { kind: "all" }
  /** 侧栏「文件夹」入口：主区展示全部文件夹层级 + 文件夹内所有项目 */
  | { kind: "folders_all" }
  | { kind: "uncategorized" }
  | { kind: "no_tags" }
  | { kind: "tag_manage" }
  | { kind: "trash" }
  | { kind: "folder"; folderId: number }

export const DEFAULT_LIBRARY_SCOPE: LibraryScope = { kind: "all" }

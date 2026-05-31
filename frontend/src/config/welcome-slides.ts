import {
  Compass,
  FolderTree,
  LayoutGrid,
  Rocket,
  type LucideIcon,
} from "lucide-react"

export type WelcomeSlide = {
  id: string
  icon: LucideIcon
  title: string
  description: string
  highlights?: string[]
}

export const WELCOME_SLIDES: WelcomeSlide[] = [
  {
    id: "intro",
    icon: Rocket,
    title: "让每一个感兴趣的项目都有迹可循",
    description:
      "Project Pilot 是本地运行的 GitHub 开源项目探索管理工具，帮你在发现、收集、筛选、体验与归档的全流程中保持秩序。",
    highlights: ["发现 → 收集 → 筛选 → 体验 → 归档", "降低「收藏了但从没试过」的心理摩擦"],
  },
  {
    id: "libraries",
    icon: FolderTree,
    title: "项目库与资料库",
    description: "按兴趣建立多个项目库，用文件夹与领域标签组织 GitHub 仓库，在应用内即可完成分类与检索。",
    highlights: ["多项目库隔离不同领域", "文件夹树 + 标签筛选", "导入导出文件夹子树包"],
  },
  {
    id: "discovery",
    icon: Compass,
    title: "发现中心",
    description: "浏览 Trending、主题探索与热门仓库，预览 README 与 Release，一键导入到资料库。",
    highlights: ["Trending / 主题 / 搜索", "仓库预览与 enrich", "导入到指定文件夹"],
  },
  {
    id: "board",
    icon: LayoutGrid,
    title: "看板与项目详情",
    description: "四列看板跟踪体验进度；项目详情页阅读 README、查看 Release，并支持简介与文档翻译。",
    highlights: ["未体验 → 正在体验 → 归档", "README 目录与分段翻译", "GitHub 元数据自动补全"],
  },
]

# Project Pilot — 待办清单

> **快照日期**：2026-06-27  
> **产品方向**（2026-06-27 定稿）：**资料库 + 发现 + 项目详情 + 内容工厂**；**不再做**看板模块、部署日志、部署方式解析等「辅助部署」能力。详见 [v0.1 设计文档 §0](./PROJECT_PILOT_v0.1_设计文档.md#0-方向修订2026-06-27)。  
> **说明**：`[x]` = 已完成；`[ ]` = 未做；`[~]` = 战略放弃 / 移出方向。

---

## P0 — 近期建议优先

| # | 项 | 状态 |
|---|-----|------|
| 1 | **桌面 v0.2.0 发版前准备**（见下节 **阶段 A**） | [x] |
| 2 | **GitHub Release 发布**（见下节 **阶段 B**，**暂缓**；由你亲手操作，AI 带领） | [ ] |
| 3 | **内容工厂**：多图 `publish_images[]`、轮播 Tab | [ ] |

---

## 桌面 v0.2.0 发版（分阶段）

> **决策（2026-06-27）**：目标版本 **v0.2.0**，首版 **零新功能**；Release 资产与 GitHub 上传 **暂不执行**，待你准备好后在新对话中按 checklist **自己动手**完成。  
> **参考**：[`PROJECT_PILOT_Release_Checklist.md`](./PROJECT_PILOT_Release_Checklist.md)、[`桌面安装包打包经验.md`](./桌面安装包打包经验.md) §6、[`PROJECT_PILOT_Desktop_Engineering_Guide.md`](./PROJECT_PILOT_Desktop_Engineering_Guide.md) Phase 0～1。

### 阶段 A — 发版前准备（**已完成 2026-06-27**）

按顺序；本地已有 **可安装的 setup.exe**，**尚未** push tag / 上传 Release。

| 步骤 | 动作 | 状态 |
|------|------|------|
| A1 | `pytest` + `npm run lint` + `npm run build` | [x] pytest 191；build 通过；lint 既有 debt |
| A2 | 版本号统一 **0.2.0**（含 `src-tauri/Cargo.toml`） | [x] |
| A3 | 仓库根目录 `.\scripts\build-desktop.ps1` | [x] |
| A4 | 安装包冒烟（§6.2） | [x] 自动化项通过；§6.2 部分 UI 项见 changelog 手工清单 |
| A5 | `release-artifacts/Project Pilot_0.2.0_x64-setup.exe`（勿 git add） | [x] |

**阶段 A 完成标准**：`release-artifacts/` 内有 0.2.0 安装包；changelog 记录验证结果。**已满足**（§6.2 外链/footer/PAT 等建议发版前再手工点一遍）。

### 阶段 B — GitHub Release（暂缓，你主导 + AI 带领）

准备好阶段 A 后，在新会话中说「按 Release Checklist 发 v0.2.0」即可逐步执行：

| 步骤 | 动作 |
|------|------|
| B1 | 确认 `git status` 干净；commit 版本/changelog（**不含** exe、`.db`） |
| B2 | `git tag v0.2.0` → `git push origin main` → `git push origin v0.2.0` |
| B3 | GitHub → Releases → 选 tag → 上传 `release-artifacts/*.exe` → 填写说明（系统要求、数据目录、无自动更新） |
| B4 | README 增加 Releases 下载链接；待办清单 P0 #2 标完成 |

**阶段 B 刻意不做的事**：GitHub Actions CI、Tauri Updater、代码签名（留 v0.2.1+）。

---

## P1 — 资料库与详情（当前主线余量）

### 筛选与导航

- [x] 资料库 **按添加时间**快捷筛选（7/30/90/365 天）
- [ ] 资料库全文搜索扩展至 **笔记** 字段
- [ ] 详情 URL **带项目库上下文**；列表 API 与当前库 scoped 一致（若仍有缺口）

### 项目详情

- [ ] **Demo 入口**（homepage / 文档链接解析，可选）
- [ ] 独立 `GET/PATCH /projects/{id}/notes`（可选；现用 `projects.notes`）
- [ ] **Markdown 编辑器**增强（现 Textarea）
- [~] 站内编辑 `name` / `full_name` — 刻意不做

### 已移出方向（仅档案，不排期）

- [~] **四列看板**及 `/projects/board` 入口（`BOARD_NAV_ENABLED=false`）
- [~] 看板拖拽、归档分区、看板页多维筛选
- [~] **`deploy_logs` 部署日志** API + 详情 Tab
- [~] Dockerfile 解析 → `deploy_methods`、部署方式自动标签
- [~] 归档时填写推荐/放弃结论（依赖看板流转）

---

## P1 — 内容工厂

### 主流程 Step 1–4

- [x] Step 1 选择项目 → Step 4 导出发布（2026-06-26）

### 封面 / 风格 / 发布增强

- [ ] **`publish_images[]` 多图上传** + Step 4 轮播预览
- [ ] 设置页配置 **预览昵称 / 头像**（小红书 mock）
- [ ] **轮播图 Tab**（6–8 页）— UI Tab 仍 `disabled`
- [ ] 参考图 **img2img 出图**
- [ ] 设置页独立 **「封面风格库」** 入口
- [ ] **「将当前封面保存为风格范例」**
- [ ] 可选：`recommend_image_prompt` + `generate-cover-prompt`
- [ ] 解构编辑器 **`color_strategy`** 子字段
- [ ] 内置风格 AI 调整后 **Fork 保存** toast 优化

### README 封面技术债

- [ ] 源画布宽度读取详情主区 **实测列宽**
- [ ] Mermaid / SVG 等复杂 README **截图回退**

---

## P1 — 标签 AI（Step 3 可选）

- [x] Step 1–2：provider + suggest + 分批 + 流式 UI
- [ ] Step 3：suggest 附带项目 **description**；导出 JSON / snapshot 撤销

---

## P2 — 体验与工程化

- [ ] **Obsidian** 单向同步（若仍需要个人归档；模板可去掉部署日志段）
- [ ] **Bookmarklet** / 浏览器快捷添加 GitHub URL
- [ ] **docker-compose** 一键部署（Project Pilot 自身部署，非「帮用户部署 starred 项目」）
- [ ] 资料库 **骨架屏**、移动端基础适配
- [ ] GitHub API **限流**统一提示
- [ ] 项目库 **封面图标、锁定态**
- [ ] 资料库 / 发现 **滚动位置 keep-alive**

### 桌面 Phase 1–2

- [x] `npm run tauri build`、README 桌面小节、账户菜单版本号
- [ ] 日志 AppData、schema 迁移、Releases CI、Updater、升级 E2E

---

## P3 — 长期

- [ ] 推荐 **Agent**、资料库 **语义搜索**
- [ ] 浏览器 **插件**、GitHub **starred 批量导入**、Star **变化提醒**
- [~] deploy.sh 生成、Portainer 联动 — **不再规划**
- [ ] xhs：苏格拉底追问、程序叠字策略 B 等（按内容工厂文档）

---

## 快速索引（已完成大块能力）

| 模块 | 交付参考 |
|------|----------|
| 资料库 / 标签 / 回收站 | CHANGELOG 2026-05-08～05-16 |
| 项目详情 + 翻译 | CHANGELOG 2026-05-17、05-24 |
| 发现中心 + 项目库层级 | CHANGELOG 2026-05-27、05-30 |
| 标签 AI + 设置 AI | CHANGELOG 2026-06-02 |
| 内容工厂 Step 1–4 + 封面/风格库 | CHANGELOG 2026-06-12～06-26 |
| 资料库添加时间筛选 + 看板移出 | CHANGELOG 2026-06-27 |

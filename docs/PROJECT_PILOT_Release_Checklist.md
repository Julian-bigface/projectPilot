# Project Pilot — 发版检查清单（v0.1.0）

> 文档版本：v1.1  
> 更新日期：2026-06-27  
> 适用：**首次 GitHub Release**（含桌面安装包上传流程）  
> **说明**：若尚未完成本地构建与冒烟，请先完成 [待办清单 — 桌面 v0.2.0 阶段 A](./PROJECT_PILOT_待办清单_2026-06-27.md#桌面-v020-发版分阶段)；**§C GitHub Release 可暂缓**，由开发者亲手操作时再执行。  
> 关联：[桌面工程化指南](./PROJECT_PILOT_Desktop_Engineering_Guide.md)、[changelogs/README.md](../changelogs/README.md)

---

## 使用说明

- 本清单以 **`v0.1.0`** 为第一个对外版本示例；后续发 `v0.2.0` 等同理，替换版本号即可。
- **桌面安装包**相关步骤，需在 [桌面工程化指南 — Phase 0](./PROJECT_PILOT_Desktop_Engineering_Guide.md#phase-0--桌面-mvp能双击跑起来) 完成后执行；若尚未接入 Tauri，可先完成 **「A. 源码发版」**，桌面包待 Phase 0 后再补 Release 资产。
- 勾选框可在本地复制到 Issue / 笔记中逐项打勾。

---

## A. 发版前：源码与质量

### A1. 功能与文档

- [ ] 本版范围已在 [`changelogs/CHANGELOG_YYYY-MM-DD.md`](../changelogs/README.md) 记录（发版当日或最近合并日）。
- [ ] [`README.md`](../README.md) 中启动说明与当前行为一致。
- [ ] 若 API 有变更：[`contracts/openapi.json`](../contracts/openapi.json) 已与后端一致。

### A2. 自动化验证

在仓库根目录执行：

```powershell
cd backend
python -m pytest -q

cd ..\frontend
npm run lint
npm run build
```

- [ ] 后端测试通过。
- [ ] 前端 lint / build 通过。

若本版改动了 OpenAPI：

```powershell
# 仓库根目录
python scripts/export_openapi.py
```

- [ ] 已重新导出并 **提交** `contracts/openapi.json`（与 API 变更同次或紧随 commit）。

### A3. 版本号对齐

| 位置 | 当前建议值 | 说明 |
|------|------------|------|
| Git tag | `v0.1.0` | 与 Release 一致，前缀 `v` |
| [`backend/app/main.py`](../backend/app/main.py) `FastAPI(..., version=...)` | `0.1.0` | 已为 `0.1.0` 时可不动 |
| [`frontend/package.json`](../frontend/package.json) `"version"` | `0.1.0` | 发版前建议从 `0.0.0` 改为 `0.1.0` |
| `src-tauri/tauri.conf.json`（接入 Tauri 后） | `0.1.0` | `package.version` |

- [ ] 上述版本语义一致（或文档说明差异原因）。

### A4. 勿提交敏感与构建产物

确认 **未** 将下列文件加入 git（规则见 [`.gitignore`](../.gitignore)）：

- [ ] `.env` / 含 Token 的配置（仅保留 `.env.example`）。
- [ ] `project_pilot.db` 或其它本地 `*.db`。
- [ ] `frontend/dist/`、`node_modules/`、`src-tauri/target/`。
- [ ] `*.exe`、`*.msi`、PyInstaller `build/` / `dist/` 产物。
- [ ] `release-artifacts/` 临时目录。

本地自检：

```powershell
git status
git diff --cached --stat
```

- [ ] 工作区干净或仅剩待发版的 intentional 变更。
- [ ] 无 `.env`、`.db`、安装包出现在 `git status` 中。

---

## B. 发版前：桌面构建（Phase 0 完成后）

> 若 `src-tauri/` 尚未就绪，**跳过本节**，先完成 A + C 的源码 tag；桌面包后续补发或发 `v0.1.1`。

### B1. 构建环境

- [ ] Node.js 20+、Rust toolchain、WebView2（Windows）可用。
- [ ] Python 3.11+ 与 `backend` 可编辑安装（`pip install -e ".[dev]"`）。

### B2. 构建顺序

```powershell
# 1. 前端静态资源
cd frontend
npm ci
npm run build

# 2. Sidecar（脚本名以仓库 scripts/ 为准，接入后填写）
# ..\scripts\build-sidecar.ps1

# 3. Tauri 安装包
npm run tauri build
```

- [ ] Sidecar 与 Tauri **同一次发版** 构建，未混用旧 sidecar。
- [ ] 构建无报错；产物路径典型为 `src-tauri/target/release/bundle/`。

### B3. 安装包冒烟测试（本机）

- [ ] 全新安装（或解压）后，双击 **一个入口** 即可打开应用。
- [ ] `GET /health` 在 sidecar 就绪后返回 ok。
- [ ] 资料库、设置、GitHub 相关核心路径可操作。
- [ ] **外链**（GitHub、文档链接）在系统浏览器打开（见 [桌面安装包打包经验 §5.8](./桌面安装包打包经验.md#58-桌面版外链点击无反应)）。
- [ ] 关闭窗口后 **无残留** `project-pilot-api` / uvicorn 进程。
- [ ] SQLite 落在 **`%LOCALAPPDATA%\ProjectPilot\`**（非 `Program Files`）。
- [ ] 卸载后用户数据目录 **默认仍保留**（符合本地优先；若策略不同需在 Release 说明）。

### B4. 待上传文件（仅 Release，不进 git）

从构建输出目录复制到 **`release-artifacts/`**（该目录已被 gitignore），例如：

- [ ] `ProjectPilot_0.1.0_x64-setup.exe` 和/或
- [ ] `ProjectPilot_0.1.0_x64_en-US.msi`

**不要** `git add` 这些文件。

---

## C. Git 与 GitHub Release

### C1. 提交并打 tag

```powershell
git add -A
git commit -m "chore: release v0.1.0"
git push origin main

git tag v0.1.0
git push origin v0.1.0
```

- [ ] `main`（或你的默认分支）已包含发版 commit。
- [ ] 远程存在 tag `v0.1.0`。

### C2. 创建 GitHub Release

1. 打开仓库 → **Releases** → **Draft a new release**。
2. **Choose a tag**：`v0.1.0`。
3. **Release title**：`Project Pilot v0.1.0`。
4. **Description**：从 changelog 摘录，建议包含：
   - 本版新增/修复摘要
   - 环境要求（Windows 10/11、WebView2）
   - 安装说明（下载 `.msi` 或 `setup.exe` 双击安装）
   - 已知问题（如有）
5. **Attach binaries**：上传 B4 中的安装包（**不是** zip 源码）。
6. 点击 **Publish release**。

- [ ] Release 页可公开访问：`https://github.com/<owner>/<repo>/releases/tag/v0.1.0`。
- [ ] 安装包附件可正常下载。

### C3. 仓库与 Release 分工（再确认）

| 内容 | Git 仓库 | GitHub Releases |
|------|----------|-----------------|
| 源码、`src-tauri/`、打包脚本 | ✅ | ❌ |
| `.exe` / `.msi` 安装包 | ❌ | ✅ |
| 发版说明 | changelog + Release 描述 | ✅ |

---

## D. 发版后

- [ ] 在 [`changelogs/README.md`](../changelogs/README.md) 索引中已有本日/发版相关条目（若发版日新建 changelog）。
- [ ] （可选）README 增加 **Releases** 下载链接。
- [ ] （可选）创建 GitHub Discussion / Issue 模板收集反馈。
- [ ] 下一版开发：继续 `npm run dev` + `uvicorn`，**不必**为改代码而重装 exe。

---

## E. v0.1.0 首版建议说明（Release 描述模板）

可复制到 GitHub Release 描述框，按实际情况删改：

```markdown
## Project Pilot v0.1.0

首个可安装桌面预览版（Windows）。

### 包含
- 资料库：文件夹树、GitHub 项目卡片、标签与回收站
- 项目详情：README / Release / 笔记
- 设置：GitHub Token、翻译目标语言等

### 系统要求
- Windows 10/11（64-bit）
- WebView2（多数系统已预装）

### 安装
1. 下载下方 **ProjectPilot_0.1.0_x64-setup.exe**（或 `.msi`）
2. 双击安装
3. 从开始菜单启动 **Project Pilot**

### 数据位置
用户数据（SQLite）位于：`%LOCALAPPDATA%\ProjectPilot\`

### 开发版
日常开发仍可从源码运行，见仓库 README。
```

---

## F. 常见问题

**Q：可以先只 push 源码 tag，不上传 exe 吗？**  
可以。Tag 标记源码里程碑；等 Phase 0 完成后再 **Edit release** 补传安装包，或发 `v0.1.1` 仅补二进制。

**Q：误把 exe commit 了怎么办？**  
不要只 revert：需从历史中移除大文件（如 `git filter-repo` / BFG），并确认 [`.gitignore`](../.gitignore) 已忽略 `*.exe`。Release 附件仍是正确分发渠道。

**Q：自动更新何时做？**  
[v0.1.x 建议手动下载](./PROJECT_PILOT_Desktop_Engineering_Guide.md#94-渐进策略)；Tauri Updater 可在 v0.2+ 启用。

---

*发版完成后，可将本清单中「Phase 0 未完成」的跳过项回收，作为下一版 `v0.1.1` / `v0.2.0` 的基线。*

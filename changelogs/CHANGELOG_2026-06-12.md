# 更新日志（2026-06-12）

## 范围

- 内容工厂 **P2 封面**：「README 首屏」模板在浏览器内截图生成 **1242×1660** 竖图封面，排版与资料库 README 标签一致。
- **前端截图路线**（`html-to-image` + 离屏 `MarkdownContent`），PNG multipart 上传落盘；**不依赖** Playwright / Chromium。
- 外链 README 图片经 **`GET /api/projects/readme-image-proxy`** 代理内联，修复 canvas 跨域导出失败。
- 源画布 **640×853** 等比放大至输出尺寸，左右留白各 **40px**（输出约 **78px**）。
- 平台排版与重新生成 Prompt 加固（`regenerate_platform.txt`、平台风格提示）。

---

## 代码变更

### 1) 封面存储与上传 API

- **新建**：[`backend/app/services/readme_cover_storage.py`](../backend/app/services/readme_cover_storage.py) — PNG 校验与落盘路径。
- **修改**：[`backend/app/api/content_factory.py`](../backend/app/api/content_factory.py) — `POST .../drafts/{draft_id}/upload-cover`（multipart）、`GET .../cover`；按 `readme_sha` 缓存。
- **修改**：[`backend/app/schemas/content_factory.py`](../backend/app/schemas/content_factory.py) — `cover_image_path`、`cover_readme_sha` 等字段。
- **修改**：[`backend/app/core/config.py`](../backend/app/core/config.py) — `content_factory_assets_dir`。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json)。

### 2) README 外链图片代理

- **新建**：[`backend/app/services/readme_image_proxy.py`](../backend/app/services/readme_image_proxy.py) — 安全校验与 httpx 拉取。
- **修改**：[`backend/app/api/projects.py`](../backend/app/api/projects.py) — `GET /api/projects/readme-image-proxy`。
- **新建**：[`backend/tests/test_readme_image_proxy.py`](../backend/tests/test_readme_image_proxy.py)。

### 3) 前端截图与封面区

- **新建**：[`frontend/src/lib/readme-cover-capture.ts`](../frontend/src/lib/readme-cover-capture.ts) — 源画布截图、`inlineCaptureImages`、等比放大至 1242×1660；常量 `README_CAPTURE_PADDING_X = 40`。
- **新建**：[`frontend/src/lib/readme-cover-truncate.ts`](../frontend/src/lib/readme-cover-truncate.ts) — 仅行数/字符上限，不做 `##` 语义截断。
- **新建**：[`frontend/src/components/content-factory/readme-cover-capture-host.tsx`](../frontend/src/components/content-factory/readme-cover-capture-host.tsx) — `#root` 内离屏渲染；优先克隆已打开的 README 标签 DOM。
- **修改**：[`frontend/src/pages/content-factory/project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — 经 `ReadmeCoverCaptureHost` 生成并上传。
- **修改**：[`frontend/src/components/content-factory/promotion-image-panel.tsx`](../frontend/src/components/content-factory/promotion-image-panel.tsx) — 预览区固定高度、`object-contain`、重新生成/下载。
- **修改**：[`frontend/src/components/project/detail/project-readme-tab.tsx`](../frontend/src/components/project/detail/project-readme-tab.tsx)、[`discovery-repo-readme-tab.tsx`](../frontend/src/components/discovery/discovery-repo-readme-tab.tsx) — `data-readme-capture-root` / `data-readme-full-name`。
- **依赖**：`frontend` 新增 `html-to-image`。

### 4) 移除 Playwright 封面路线

- **删除**：后端 `readme_cover_render.py` 与 optional `[cover]`（playwright/markdown）；桌面构建不再要求 Chromium 封面依赖。

### 5) 测试与文档

- **修改**：[`backend/tests/test_readme_cover_storage.py`](../backend/tests/test_readme_cover_storage.py)、[`test_content_factory.py`](../backend/tests/test_content_factory.py) — `upload-cover` 与存储。
- **新建**：[`frontend/src/lib/readme-cover-truncate.test.ts`](../frontend/src/lib/readme-cover-truncate.test.ts)。
- **修改**：[`README.md`](../README.md) — 「内容工厂 README 封面」完整说明（尺寸、裁切、代理、缓存、验证）。
- **修改**：[`scripts/build-sidecar.ps1`](../scripts/build-sidecar.ps1) — 移除 Playwright 封面备注。

---

## 验证记录

- **自动化**：`pytest backend/tests/test_readme_cover_storage.py backend/tests/test_readme_image_proxy.py backend/tests/test_content_factory.py`；`cd frontend && npm test -- --run readme-cover`；`npm run build`；`python scripts/export_openapi.py`。
- **手工**：GitHub Token 已配置 → 内容工厂草稿 → 封面区「README 首屏」→ 预览与下载；README `sha` 未变时二次进入应命中缓存；「重新生成」强制覆盖；可选先打开项目 README 标签再生成以对比排版。

---

## 后续建议

- 封面源画布宽度可改为读取项目详情主区实测列宽，进一步消除与 README 标签的像素级偏差。
- 复杂 README（Mermaid/SVG）若截图异常，可迭代专用回退或首图提取。

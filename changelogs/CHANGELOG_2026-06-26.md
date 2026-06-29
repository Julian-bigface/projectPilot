# 更新日志（2026-06-26）

## 范围

- **内容工厂 Step 4 导出发布**：编辑优化完成后可通过 Stepper 或「导出发布」按钮进入；小红书草稿展示左编辑右手机预览双栏，实时同步标题/正文/封面，支持复制发布包与下载封面。
- **非小红书草稿**：Step 4 显示简化导出页（Markdown 复制/下载），可引导切换至小红书平台。

---

## 代码变更

### 1) Stepper 可导航与步骤持久化

- **修改**：[`frontend/src/components/content-factory/promotion-stepper.tsx`](frontend/src/components/content-factory/promotion-stepper.tsx) — 支持 `onStepClick` / `isStepClickable`，Step 3↔4 可点击切换。
- **修改**：[`frontend/src/pages/content-factory/project-promotion.tsx`](frontend/src/pages/content-factory/project-promotion.tsx) — `enterExportStep` / `leaveExportStep` / `flushPendingSaves`；`draft.step` 写入 3 或 4；编辑区底部「导出发布」CTA。

### 2) 小红书发布预览与导出面板

- **新建**：[`frontend/src/components/content-factory/promotion-export-panel.tsx`](frontend/src/components/content-factory/promotion-export-panel.tsx) — 左图稿+文案编辑、右手机预览、复制发布内容。
- **新建**：[`frontend/src/components/content-factory/xhs-phone-preview.tsx`](frontend/src/components/content-factory/xhs-phone-preview.tsx)、[`xhs-note-preview-content.tsx`](frontend/src/components/content-factory/xhs-note-preview-content.tsx)、[`xhs-cover-preview-content.tsx`](frontend/src/components/content-factory/xhs-cover-preview-content.tsx)。
- **新建**：[`frontend/src/components/content-factory/promotion-export-fallback.tsx`](frontend/src/components/content-factory/promotion-export-fallback.tsx) — 非小红书简化导出。

### 3) 发布包拼接工具

- **新建**：[`frontend/src/lib/content-factory-publish-bundle.ts`](frontend/src/lib/content-factory-publish-bundle.ts) — `buildXhsPublishBundle`（标题 + 正文 + 话题标签）。
- **新建**：[`frontend/src/lib/content-factory-publish-bundle.test.ts`](frontend/src/lib/content-factory-publish-bundle.test.ts)。

### 4) 导出页 UX 精修

- **修改**：[`frontend/src/components/content-factory/xhs-cover-preview-content.tsx`](frontend/src/components/content-factory/xhs-cover-preview-content.tsx) — 封面预览改为小红书「发现」双列瀑布流 mockup（状态栏、顶栏 Tab、分类栏）。
- **修改**：[`frontend/src/components/content-factory/promotion-stepper.tsx`](frontend/src/components/content-factory/promotion-stepper.tsx)、[`project-promotion.tsx`](frontend/src/pages/content-factory/project-promotion.tsx) — 移除底部「导出发布」与导出页底栏；Step 3/4 点击导航；Step 4 在导出页可点击确认发布（打勾动画）；`status: published` + `body_json.published_at`。
- **修改**：[`frontend/src/components/content-factory/content-factory-sidebar.tsx`](frontend/src/components/content-factory/content-factory-sidebar.tsx) — 已发布草稿显示绿色「已发布」标记。
- **修改**：[`frontend/src/lib/xhs-title-length.ts`](frontend/src/lib/xhs-title-length.ts) — 小红书标题字数：中文计 1、英文字母每 2 个计 1（向上取整）；`PromotionTitlePicker` 计数与超限提示同步。

---

## 验证记录

- **自动化**：`npm run test -- content-factory-publish-bundle`（3 passed）；`npm run build`（通过）。
- **手工**：小红书草稿生成文案与封面 → Stepper 点「导出发布」或点「编辑优化」进入导出；封面预览为发现页双列瀑布流；Step 3 打勾后点回编辑；无底部操作栏。

---

## 后续建议

- Phase 2：`publish_images[]` 多图上传与轮播预览；设置页配置预览昵称/头像。

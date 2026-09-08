# Agent Note: 编排页 Host catalog 可见性开关

Status: implemented

[English](2026-09-08-orchestrator-host-catalog-visibility-toggle.md) | 中文

## 问题

Host catalog 上画布后，每次打开编排都会同时显示 composition 与淡色 Host-only 节点。只想看当前 Preset 的操作者无法在不离开 Tab 的情况下隐藏 Host 层。

## 决策

工具栏 checkbox **显示宿主已加载** 默认 **关**。`fromInventory` 仍填充 `catalog[]`；关闭时由 `documentForCanvas(doc, includeHostCatalog)` 在投影前去掉 catalog。状态为本次 Tab 挂载的 React `useState`（不写 settings）。隐藏时清除 catalog 选中。规格：[`docs/superpowers/specs/2026-09-08-orchestrator-host-catalog-visibility-toggle-design.zh.md`](../../../../docs/superpowers/specs/2026-09-08-orchestrator-host-catalog-visibility-toggle-design.zh.md)。

## 曾考虑的替代

- **默认开启（先前全量视图）** — 否决；产品选择 Preset 优先。
- **写入 settings / localStorage** — 延后；本切 Tab 内状态足够。
- **在 `toGraphDocument` 上加 `includeHostCatalog`** — 否决；纯文档过滤不改投影器且更易测。

## 后果

- README 说明默认仅 Preset 与 checkbox。
- Live 高亮无论开关如何仍只作用于 composition。

## 测试

- `pnpm --filter dsh-agent-orchestrator exec vitest run`（`document-for-canvas` + 既有套件）。
- `pnpm --filter dsh-agent-orchestrator bundle`。

# agent-orchestrator：工具栏开关控制 Host catalog 可见性

[English](2026-09-08-orchestrator-host-catalog-visibility-toggle-design.md) | 中文

**状态：** 已批准设计（2026-09-08）

**范围：** 仅 `plugins/agent-orchestrator` Client 编排 Tab。无 Host Remote 改动、无持久化、不改 `fromInventory` / inventory 契约。

**相关：** [画布上的 Host catalog](2026-09-08-orchestrator-host-catalog-on-canvas-design.zh.md)（文档仍始终携带完整 `catalog[]`）。

## 产品

操作者经常只想看当前 Preset 的组合。Host-only（淡色）节点是可选上下文。

工具栏 checkbox **显示宿主已加载** / **Show Host-loaded**：

| 状态 | 画布 |
|---|---|
| 关（默认） | 仅 `composition` |
| 开 | `composition ∪ catalog`（当前全量视图） |

状态为本次 Orchestrate Tab 挂载内的 React `useState`。切换 Preset 选择 **不** 重置 checkbox。刷新或离开后再打开 Tab 重置为 **关**。

## 投影

`fromInventory` 仍始终填充 `catalog`。调用 `toGraphDocument` 前，若 checkbox 关闭，传入 `catalog: []` 的文档副本。勿就地清空仍用于细节查找的 inventory 文档（隐藏时不得打开已不在画布上的 Host-only 节点）。

将 checkbox **关掉** 时，若当前检视单元归属为 `catalog`，清除选中（及 AITopo 选中）。

Live 高亮仍仅 composition，行为不变。

## 文案

- Checkbox 标签：locale 键（中/英）。
- 隐藏 Host catalog 时：hint 去掉「淡色 = 宿主」归属句（或改用仅 Preset 的 membership hint）。
- 显示时：沿用现有实心 / 淡色 membership hint。

## 非目标

- 持久化偏好（settings / localStorage）。
- 改动 Host `agentOrchestrator.document()`。
- 高亮 catalog 节点。
- 分段控件 / 除显示隐藏 catalog 外的第二种画布模式。

## 测试

- 单元或薄视图模型辅助：`includeHostCatalog: false` 时图节点仅来自 composition id。
- 选中 catalog 单元后再隐藏时清除选中（若抽出判定函数则测之；否则覆盖辅助逻辑）。
- 既有 catalog 布局 / live 仅 composition 测试保持通过。

# agent-orchestrator：工具栏 Preset 与宿主已加载插件数量

[English](2026-09-08-orchestrator-plugin-count-stats-design.md) | 中文

**状态：** 已批准设计（2026-09-08）

**范围：** 仅 `plugins/agent-orchestrator` Client 编排 Tab 工具栏。无 Host Remote 改动、无持久化、不改 `fromInventory` / 画布投影。

**相关：** [Host catalog 可见性开关](2026-09-08-orchestrator-host-catalog-visibility-toggle-design.zh.md)（checkbox 仍只控制画布）。

## 产品

操作者需要快速看到：当前选中 Preset 内的插件数，以及已由宿主加载但不在该 Preset 中的插件数。

工具栏在 Preset 选择后显示只读内联统计：

| 计数 | 来源 |
|---|---|
| 本 Preset | `orchestrationDoc.composition.length` |
| 宿主已加载 | `orchestrationDoc.catalog.length` |

数字始终取自当前 Preset 的完整 inventory 文档。**显示宿主已加载** checkbox **不**改变这些数字，只控制 catalog 节点是否画在画布上。切换 Preset 选择会更新两个数字。

## 文案

Locale 键（中/英），对齐现有归属用语：

- zh: `本 Preset {composition} · 宿主已加载 {catalog}`
- en: `This Preset {composition} · Host-loaded {catalog}`

产品文案不引入 Session / Global 等新词。

## UI

放在现有 `.toolbar` 同一行，作弱化次要文字（透明度接近标签 / hint）。无交互、不另起工具栏行、无卡片。

## 非目标

- 只统计当前画布可见节点。
- 将计数持久化或同步到 Host / settings。
- 改动 live 高亮、详情面板或图投影。
- 在产品 UI 中使用 Session / Global 命名。

## 测试

- 从 `orchestrationDoc`（而非 `canvasDoc` / `documentForCanvas` 输出）取数，使 `includeHostCatalog: false` 时若读取 inventory 文档仍报告完整 catalog 长度。
- 既有 Host-catalog 可见性与 live 高亮测试保持通过。

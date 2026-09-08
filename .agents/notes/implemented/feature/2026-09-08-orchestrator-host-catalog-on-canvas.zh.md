# Agent Note: 编排 Preset 画布上的 Host catalog

Status: implemented

[English](2026-09-08-orchestrator-host-catalog-on-canvas.md) | 中文

## Problem

编排 Tab 只显示选中 Preset 的组合行。运维若要对照「本 Preset 挂了什么」与「Host 进程已加载什么」，只能离开画布或另开库存页，且仅 Host 的插件不会出现在 wiki/011 分层带中。

## Decision

Client 用 `pluginInventory/list` 经 `fromInventory(preset, entries)` 构建每个 Preset 的 `OrchestrationDocument`：`composition` 仍为本 Preset 行；`catalog` 为对不上任何 composition 单元的 Loader `entries`（优先 `entryId`，否则 `moduleName`）。重叠只保留一个 composition 节点。

`toGraphDocument` 在同一架构层分带中布局 `composition ∪ catalog`（层内 composition 在前）。catalog 节点使用淡色调色与 `membership: 'catalog'` / meta `host`。Live tool 高亮仍只映射 `composition`。Host `agentOrchestrator.document()` 仍返回仅 preset 的文档（`catalog: []`），直至后续 Host 切口需要 Loader entries。

规格：[`docs/superpowers/specs/2026-09-08-orchestrator-host-catalog-on-canvas-design.md`](../../../../docs/superpowers/specs/2026-09-08-orchestrator-host-catalog-on-canvas-design.zh.md)。

## Alternatives considered

- **单一 `composition` 数组加 `membership` 字段** — 本切口拒绝；框架文档已为「可选但未选中」预留 `catalog[]`，与仅 Host 的 Loader 行一致，也便于 F1 从 catalog 拖入 composition。
- **不填 `catalog`、仅 Client 叠加绘制** — 拒绝；Host/Client 文档与测试会分叉，选择/详情缺少共享 unit 模型。
- **所有 Preset 行并集或 wiki/011 全包列表** — 拒绝；「已加载」指 Loader `entries` ∪ 本 Preset 的 rows。

## Consequences

- `plugins/agent-orchestrator/src/from-inventory.ts` 负责去重；Client `OrchestratorView` 将 `snapshot.entries` 传入 `fromInventory`。
- README 说明同一画布上实心 = Preset · 淡色 = 仅 Host。
- Live 高亮与详情中的 live 行忽略 catalog 归属。

## Testing

- `pnpm --filter dsh-agent-orchestrator test`（from-inventory 去重、to-graph catalog 绘制 / 仅 catalog 画布、live 仅 composition 合同）。
- `pnpm --filter dsh-agent-orchestrator typecheck` 与 `bundle`。

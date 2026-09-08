# Agent Note: AITopo GraphEdge 悬停高亮

Status: implemented

[English](2026-09-08-aitopo-edge-hover-highlight.md) | 中文

## Problem

AITopo 已能绘制并可选中边，且 `hoverChanged` 已携带通用元素 id，但 `hitTestScreen` 只解析节点。运维无法悬停 `GraphEdge` 来高亮连线。

## Decision

在 `vendor/aitopo`：

- 增加 `distanceToSegment` / `distanceToPolyline`，以及按绘制用的同一套 `edgeAnchors()` 折线做 `hitTestEdges`。
- `hitTestScreen` 返回 `{ id, kind: 'node' | 'edge' }` — 先节点，再边（容差 `4 / zoom`）。
- `EdgePaintView.hovered` 使用与选中相同的加粗描边；现有 `hoverChanged` 携带 edge id。
- 边的 pointer-down 会选中该边，但不调用 `activateNode`。
- 当 `scene.hover` 是**节点** id 时，入射/出射且 `kind === 'data'` 的边也按 hovered 绘制，以便弱化默认数据线后仍能看清载荷路由。
- 高亮（悬停 / 选中）边绘制在 **overlay** canvas 上，避免被 root 层节点填充遮挡。

`plugins/agent-observe` 为 data 边设置弱对比 idle `stroke`（`#3a4846`）与悬停青绿 `strokeHover`（`#5eead4`）；flow 边仍为灰 / 蓝。

记入 `vendor/README.md` 本地修改第 20 条。

## Alternatives considered

- **新增 `edgeHovered` 事件。** 拒绝：`hoverChanged.hoverId` 已覆盖任意元素 id。
- **像素级 canvas 拾取。** 本次不做：折线距离与绘制几何一致且开销低。

## Consequences

- 平移仍只在空白处开始（命中边会挡住平移，与节点相同）。
- 必验：`pnpm --filter @neuravoxel/aitopo test`（或 `cd vendor/aitopo && pnpm test`）。

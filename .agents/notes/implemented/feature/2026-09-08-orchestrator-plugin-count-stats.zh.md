# Agent Note: 编排工具栏 Preset 与宿主已加载数量

Status: implemented

[English](2026-09-08-orchestrator-plugin-count-stats.md) | 中文

## Problem

打开编排时，操作者无法一眼看到：选中 Preset 内有多少插件，以及宿主已加载但不在该 Preset 中的插件有多少——尤其在画布隐藏 Host catalog 时。

## Decision

工具栏在 Preset 选择后显示只读 locale 行 **本 Preset {composition} · 宿主已加载 {catalog}**（en: **This Preset … · Host-loaded …**）。数字来自 `pluginCountsFromDocument(orchestrationDoc)`——当前 Preset 完整文档的 `composition.length` / `catalog.length`——不跟随 `documentForCanvas` /「显示宿主已加载」checkbox。规格：[`docs/superpowers/specs/2026-09-08-orchestrator-plugin-count-stats-design.zh.md`](../../../../docs/superpowers/specs/2026-09-08-orchestrator-plugin-count-stats-design.zh.md)。相关：[Host catalog 可见性开关](2026-09-08-orchestrator-host-catalog-visibility-toggle.zh.md)。

## Alternatives considered

- **只统计当前画布可见节点** — 否决；catalog 隐藏时仍需要宿主已加载总量。
- **产品文案用 Session / Global** — 否决；沿用现有 Preset / 宿主已加载用语。
- **工具栏下方单独统计行** — 否决；内联弱化文字更符合现有 toolbar 密度。

## Consequences

- README 写明工具栏计数取自完整 inventory 文档，且与画布 checkbox 无关。
- Live 高亮与详情面板不变。

## Testing

- `pnpm --filter dsh-agent-orchestrator exec vitest run`（`plugin-counts` 断言完整文档计数相对隐藏画布 catalog）。
- `pnpm --filter dsh-agent-orchestrator bundle`.

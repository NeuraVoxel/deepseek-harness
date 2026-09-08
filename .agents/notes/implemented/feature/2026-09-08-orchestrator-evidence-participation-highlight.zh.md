# Agent Note: 基于 Session 证据的编排参与高亮

Status: implemented

[English](2026-09-08-orchestrator-evidence-participation-highlight.md) | 中文

## 问题

编排页 live 高亮只跟随回合内 `tool/call` 名称。通过 Session 事件参与、却没有 tool 别名的插件（压缩、审批、hooks 等）在 turn 执行时仍保持暗色，画布会低估真实参与。

## 决策

仍只采用 Session 日志证据（Client 折叠）。`deriveCompositionActivity` 增加最新回合上 curated 事件类型推出的 `turnModuleNames`；`participation-map` 将事件类型映射到包模块名并解析 composition 单元 id；`OrchestratorView` 把 tool 与 module 命中并入回合高亮。Catalog / Host-only 节点保持暗色；Fiber `active` 不算参与。完整 Cordis 参与追踪需要新的 Session 事件 / Host Remote，本切延后。

规格：[`docs/superpowers/specs/2026-09-08-orchestrator-evidence-participation-highlight-design.zh.md`](../../../../docs/superpowers/specs/2026-09-08-orchestrator-evidence-participation-highlight-design.zh.md)。

## 曾考虑的替代

- **以 Fiber 挂载 / `active` 为参与** — 否决；挂载≠回合证据，会点亮无日志的 spine 插件。
- **完整 Cordis 调用追踪** — 延后；需要超出本插件的核心 Session 事件 / Remote 改动。
- **仅用生成的 tool-catalog 做映射** — tool 别名延后；事件→模块表以 curated 精确映射先上线。

## 后果

- 既无 tool、也无 curated 事件证据的 composition 单元按设计保持暗色。
- 扩大覆盖应往 `participation-map` 增补 Session 事件类型（或之后从 catalog 生成），而不是从 Loader 状态推断。

## 测试

- `pnpm --filter dsh-agent-orchestrator exec vitest run`（participation-map、derive turnModuleNames、withLiveActivity 模块高亮）。
- `pnpm --filter dsh-agent-orchestrator bundle`。

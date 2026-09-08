# Agent Orchestrator F0（只读 Preset 组合画布）

[English](2026-09-08-agent-orchestrator-f0.md) | 中文

## 决策

交付可选 Cordis 插件 `plugins/agent-orchestrator`（`dsh-agent-orchestrator`）：以 **OrchestrationDocument** 为组合权威。F0 将 agent-preset 库存投影到 `@neuravoxel/aitopo`，作为对话区 **只读** Tab。可编辑图交互等待 AITopo Editor 里程碑；插件不得用 DOM/SVG 自行实现拖拽等编辑能力。

Client F0 通过既有 `remote.pluginInventory.list` 拉库存，不向 `dsh-api-remotes` 新增 Typert Remote，避免可选插件扩大已发布 Remote 装配。Host `ctx.agentOrchestrator` 仍从 `agentPresets.compositionInventory` 构建同一文档，供 Host 调用方与后续 commit sink 使用。

## 曾考虑的方案

- **F0 即加专用 Typert Remote** — 推迟；F1 commit API 再加；只读库存已由 plugin-inventory 暴露。
- **并入 agent-observe** — 否决；观察 Tab 展示会话/轮次拓扑，orchestrator 编排组合。
- **仅 Settings vs 对话 Tab** — F0 用 conversation view（id `orchestrator`），与 Canvas 并列便于发现。

## 后果

- `pnpm-workspace.yaml` 列入 `plugins/agent-orchestrator`。
- 设计：`plugins/agent-orchestrator/docs/2026-09-08-agent-orchestrator-design.md`。
- AITopo Editor 需求：`vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md`。

## 验证

- `pnpm --filter dsh-agent-orchestrator test`
- `pnpm --filter dsh-agent-orchestrator typecheck`
- `pnpm --filter dsh-agent-orchestrator bundle`
- 手工：`pnpm --filter dsh-agent-orchestrator bundle && pnpm dsh web --patch ./plugins/agent-orchestrator/cordis.patch.yml` → Orchestrate Tab 显示 preset 行。

# dsh-agent-orchestrator F0 Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship read-only F0 of `dsh-agent-orchestrator`: OrchestrationDocument from preset inventory, GraphDocument projection, conversation tab with AITopo (no edit).

**Architecture:** Pure adapters own document ↔ graph. Host `agentOrchestrator` builds documents from `agentPresets.compositionInventory`. Client loads via existing `remote.pluginInventory.list()` (no new Typert Remote in F0). Edit gestures wait on AITopo Editor milestone.

**Tech Stack:** Cordis plugin under `plugins/`, React Client, `@neuravoxel/aitopo`, vitest.

**Design:** [2026-09-08-agent-orchestrator-design.md](./2026-09-08-agent-orchestrator-design.md)

**Status:** F0 implemented (2026-09-08).

---

### Task 1: Scaffold

- [x] Add `plugins/agent-orchestrator` to `pnpm-workspace.yaml`
- [x] `package.json`, `tsconfig.json`, `tsdown.config.mjs`, `vitest.config.ts`, `cordis.patch.yml`
- [x] `pnpm install`

### Task 2: Document model + adapters + tests

- [x] `src/types.ts` — OrchestrationDocument
- [x] `src/from-preset.ts` — preset composition → document
- [x] `src/to-graph.ts` — document → GraphDocument + layout
- [x] Specs: round-trip ids, enabled vs disabled status, broken preset

### Task 3: Host service

- [x] `src/index.ts` — `AgentOrchestratorService`, inject `agentPresets`, `document(presetId?)`

### Task 4: Client read-only UI

- [x] Copy/adapt `AITopoHost`, locales, OrchestratorView, conversation.view id `orchestrator`
- [x] inject: load via `remote.pluginInventory.list`

### Task 5: Docs + verify

- [x] Update README for how to run
- [x] Agent Note
- [x] `pnpm --filter dsh-agent-orchestrator test && typecheck && bundle`

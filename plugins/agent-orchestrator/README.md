# agent-orchestrator

English | [中文](README.zh.md)

Opt-in plugin: Harness **orchestration framework** (F0 = read-only). The Orchestration Document is authoritative; [@neuravoxel/aitopo](../../vendor/aitopo) is the projected stage; Client loads preset rows via `remote.pluginInventory.list`.

- Design: [docs/2026-09-08-agent-orchestrator-design.md](./docs/2026-09-08-agent-orchestrator-design.md)
- F0 plan: [docs/2026-09-08-agent-orchestrator-f0-plan.md](./docs/2026-09-08-agent-orchestrator-f0-plan.md)
- AITopo Editor requirements: [vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md](../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md)
- Sibling of [agent-observe](../agent-observe/README.md): observe tab shows runtime topology; this plugin projects composition.

## How to run

```sh
pnpm install
pnpm --filter dsh-agent-orchestrator bundle
pnpm dsh web --patch ./plugins/agent-orchestrator/cordis.patch.yml
```

Open a Session → **Orchestrate** tab. Pick a preset to view its composition rows (read-only). The canvas bands plugins by the [wiki/011 nine layers](../../wiki/011-插件分组与主要作用.md) (only layers with members appear). When viewing the **session's** preset during a running turn, in-flight `tool/call` names light matching composition units (Observe keeps business flow / data-flow). Click a plugin node for entry id, module, architecture layer, package group, enablement, condition, fiber phase, and lock. A 28px icon on `conversation.chat.assistant-actions` (beside Turn usage) also opens this tab; Turn-scoped payload injection is deferred.

Or install into a profile:

```sh
pnpm --filter dsh-agent-orchestrator bundle
pnpm dsh plugin --profile web-orchestrator-demo add ./plugins/agent-orchestrator
pnpm dsh --profile web-orchestrator-demo
```

## Layout

| Path | Role |
|---|---|
| `src/index.ts` | Host `ctx.agentOrchestrator` |
| `src/types.ts` / `from-preset.ts` / `to-graph.ts` | Document + adapters |
| `src/architectural-layer.ts` / `npm-package-group.ts` | wiki/011 layer resolve (npm → package group → layer) |
| `src/map-tool-activity.ts` | Running tool → composition-unit highlight |
| `src/client/` | Conversation tab + turn-tail shortcut + AITopoHost + Session activity source |

## Known Limitations and Deferred Work

- F0 is read-only; editing waits on AITopo Editor (AT-E*).
- No dedicated orchestrator Typert Remote yet; Client uses plugin-inventory.
- Commit / preset write-back is F1.

## Model Experience

No model-facing copy or tools.

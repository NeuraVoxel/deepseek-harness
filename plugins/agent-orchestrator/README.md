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

Open a Session → **Orchestrate** tab. Pick a preset to view its composition rows (read-only).

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
| `src/client/` | Conversation tab + AITopoHost |

## Known Limitations and Deferred Work

- F0 is read-only; editing waits on AITopo Editor (AT-E*).
- No dedicated orchestrator Typert Remote yet; Client uses plugin-inventory.
- Commit / preset write-back is F1.

## Model Experience

No model-facing copy or tools.

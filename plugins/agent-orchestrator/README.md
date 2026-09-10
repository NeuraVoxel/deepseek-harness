# agent-orchestrator

English | [中文](README.zh.md)

Opt-in plugin: Harness **orchestration framework** (F1 chrome = canvas edit; CommitSink later). The Orchestration Document is authoritative; [@neuravoxel/aitopo](../../vendor/aitopo) is the projected stage; Client loads preset rows via `remote.pluginInventory.list`.

- Design: [docs/2026-09-08-agent-orchestrator-design.md](./docs/2026-09-08-agent-orchestrator-design.md)
- F0 plan: [docs/2026-09-08-agent-orchestrator-f0-plan.md](./docs/2026-09-08-agent-orchestrator-f0-plan.md)
- AITopo Editor requirements: [vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md](../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md)
- Wave D (F1 chrome): [vendor/aitopo/docs/2026-09-10-aitopo-wave-d-orchestrator-f1-chrome.md](../../vendor/aitopo/docs/2026-09-10-aitopo-wave-d-orchestrator-f1-chrome.md)
- Sibling of [agent-observe](../agent-observe/README.md): observe tab shows runtime topology; this plugin projects composition.

## How to run

```sh
pnpm install
pnpm --filter dsh-agent-orchestrator bundle
pnpm dsh web --patch ./plugins/agent-orchestrator/cordis.patch.yml
```

Open a Session → **Orchestrate** tab. Pick a preset to view its composition rows. Drag unlocked nodes (user presets); system-preset rows stay locked. Shift+empty drag marquees; corner handles resize (session paint only). Undo/Redo use AITopo `PatchHistory`. Layout edits are **session-local** until CommitSink / preset write-back lands. The canvas bands plugins by the [wiki/011 nine layers](../../wiki/011-插件分组与主要作用.md) (only layers with members appear), stacked with foundation ① at the **bottom** and higher layers toward the top. The toolbar shows **This Preset** / **Host-loaded** counts from the full inventory document for the selected Preset (unchanged by the canvas checkbox). By default the canvas shows **this Preset only**; check **Show Host-loaded** to also draw Host Loader plugins that are loaded but not in that Preset as muted nodes in the same bands (solid = Preset · muted = Host-only; overlaps stay one solid node). The checkbox state lasts for this tab mount only. When viewing the **session's** preset during a running turn, Session-log evidence lights matching **composition** units only: `tool/call` names plus curated non-tool events (compaction, approval, hooks, …) via a static event→module map; silent spine plugins stay dark (Observe keeps business flow / data-flow). Click a plugin node for membership, entry id, module, architecture layer, package group, enablement, condition, fiber phase, and lock. A 28px icon on `conversation.chat.assistant-actions` (beside Turn usage) also opens this tab; Turn-scoped payload injection is deferred.

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
| `src/types.ts` / `from-preset.ts` / `from-inventory.ts` / `to-graph.ts` | Document + adapters |
| `src/architectural-layer.ts` / `npm-package-group.ts` | wiki/011 layer resolve (npm → package group → layer) |
| `src/map-tool-activity.ts` | Running tool → composition-unit highlight |
| `src/participation-map.ts` | Session event type → module → composition-unit highlight |
| `src/document-for-canvas.ts` | Optionally omit Host catalog for canvas projection |
| `src/session-layout.ts` | Session-local layout merge for F1 chrome |
| `src/client/` | Conversation tab + turn-tail shortcut + AITopoHost + Session activity source |

## Known Limitations and Deferred Work

- F1 chrome ships (move / marquee / resize / undo); CommitSink / preset write-back is still deferred.
- No dedicated orchestrator Typert Remote yet; Client uses plugin-inventory.
- Catalog↔composition membership is not edited via layer drop-target.

## Model Experience

No model-facing copy or tools.

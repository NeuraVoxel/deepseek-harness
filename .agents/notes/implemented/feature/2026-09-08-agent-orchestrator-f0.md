# Agent Orchestrator F0 (read-only preset composition canvas)

English | [中文](2026-09-08-agent-orchestrator-f0.zh.md)

## Decision

Ship `plugins/agent-orchestrator` (`dsh-agent-orchestrator`) as an opt-in Cordis plugin whose **OrchestrationDocument** is the composition authority. F0 projects agent-preset inventory onto `@neuravoxel/aitopo` as a **read-only** conversation tab. Editable graph gestures wait on the AITopo Editor milestone; the plugin must not reimplement them in DOM/SVG.

Client F0 loads inventory through existing `remote.pluginInventory.list` rather than adding a Typert Remote to `dsh-api-remotes`, so the opt-in plugin does not enlarge the shipped Remote assembly. Host `ctx.agentOrchestrator` still builds the same documents from `agentPresets.compositionInventory` for Host-side callers and future commit sinks.

## Alternatives considered

- **Dedicated Typert Remote in F0** — deferred; correct for F1 commit APIs, unnecessary for read-only inventory already exposed by plugin-inventory.
- **Merge into agent-observe** — rejected; observe tab shows session/turn topology, orchestrator authors composition.
- **Conversation tab vs settings-only** — F0 uses a conversation view sibling (id `orchestrator`) for discoverability beside Canvas.

## Consequences

- `pnpm-workspace.yaml` lists `plugins/agent-orchestrator`.
- Design: `plugins/agent-orchestrator/docs/2026-09-08-agent-orchestrator-design.md`.
- AITopo Editor asks: `vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md`.

## Verification

- `pnpm --filter dsh-agent-orchestrator test`
- `pnpm --filter dsh-agent-orchestrator typecheck`
- `pnpm --filter dsh-agent-orchestrator bundle`
- Manual: `pnpm --filter dsh-agent-orchestrator bundle && pnpm dsh web --patch ./plugins/agent-orchestrator/cordis.patch.yml` → Orchestrate tab shows preset rows.

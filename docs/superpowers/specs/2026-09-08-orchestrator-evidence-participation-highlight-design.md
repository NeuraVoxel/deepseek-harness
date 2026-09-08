# agent-orchestrator: evidence-based turn participation highlight

English | [中文](2026-09-08-orchestrator-evidence-participation-highlight-design.zh.md)

**Status:** approved design (2026-09-08)

**Scope:** `plugins/agent-orchestrator` only. Extends Client-side Session event folding. No new Session event types, no Host Remote, no Loader/fiber polling, no agent-loop changes.

**Related:** Host catalog on canvas ([2026-09-08-orchestrator-host-catalog-on-canvas-design.md](./2026-09-08-orchestrator-host-catalog-on-canvas-design.md)); current tool-name path in `map-tool-activity.ts` / `derive-activity.ts`.

## Product

While a Session is running and the Orchestrate canvas shows that Session’s Preset, light every **composition** unit that has **Session-log evidence** of participation on the latest turn — not merely Fiber `active` (mounted) and not Host-only `catalog` nodes.

Evidence means: a tool name from `tool/call` (or embedded assistant tool-call parts), or a curated non-tool turn event whose type maps to a known package.

Plugins that work silently every step without a distinct Session event (system-prompt assembly, agent-loop, LLM adapter, most guards) stay unlit. Full Cordis participation tracing requires core source changes and is out of scope.

## Signals

Reuse `deriveCompositionActivity` turn scoping (`turn/start` seq window, `session.running`).

| Signal | Maps to units via |
|---|---|
| `tool/call` / assistant `tool-call` names (running + this turn) | Tool name → module / entry leaf (existing aliases; prefer tool-catalog alignment when cheap) |
| Curated event types in the same turn window | Static `event.type` → module name(s) |

Initial non-tool event map (extend as gaps appear; unknown types ignored):

| Event prefix / type | Target module hint |
|---|---|
| `compaction/*` | `@deepseek-ai/dsh-compaction` (and compaction provider packages if distinct in composition) |
| `approval/*` | `@deepseek-ai/dsh-user-approval` |
| `hook/invoked`, `hook/result` | hook-bridge packages present in composition (match by module suffix / known ids) |
| `command/run`, `command/done` | `@deepseek-ai/dsh-commands` |
| `llm/retry`, `llm/retry-started` | `@deepseek-ai/dsh-llm-retry` |
| `plan/mode` | `@deepseek-ai/dsh-plan-mode` |
| `todo/write` | `@deepseek-ai/dsh-tool-todo` (also covered by tool/call when present) |

Unit resolution: match mapped module names (and tool aliases) against **composition** units by `moduleName` / entry leaf — same style as `unitIdsForToolName`. Unmatched hints are dropped.

## Highlight rules

Unchanged gates:

- Live paint only when viewed Preset is the Session `agentPreset` (or preset unknown) and `session.running`.
- **Composition only** — never catalog.
- Running tools → strong live style; finished this-turn tools and non-tool event hits → turn style.

Merge sets: `liveUnitIds(tools) ∪ unitIdsForModules(eventModules)`.

## Non-goals

- Fiber `active` as participation.
- New Session events / Host participation Remote (full tracing).
- Lighting silent spine plugins without log evidence.
- Editing / AITopo Editor.

## Tests

Plugin vitest:

- Compaction / approval / command (and similar) events in the latest turn light matching composition units.
- Unknown event types do not light units.
- Existing tool→unit mapping still works; catalog units stay dark; wrong Preset stays dark.

## Docs

- README: participation highlight is evidence-based from the Session log.
- Agent Note: why A (event evidence) beat Fiber polling and full tracing for this cut.

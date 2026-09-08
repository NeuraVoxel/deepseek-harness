# Agent Note: Evidence-based orchestrator participation highlight

Status: implemented

English | [中文](2026-09-08-orchestrator-evidence-participation-highlight.zh.md)

## Problem

Orchestrate live paint only followed in-flight / turn `tool/call` names. Plugins that participate through Session events without a tool alias (compaction, approval, hooks, …) stayed dark while a turn was running, so the canvas understated real participation.

## Decision

Stay on Session-log evidence only (Client fold). `deriveCompositionActivity` adds `turnModuleNames` from curated event types on the latest turn; `participation-map` maps those types to package module names and resolves composition unit ids; `OrchestratorView` unions tool and module hits for turn paint. Catalog / Host-only nodes stay dark; Fiber `active` is not participation. Full Cordis participation tracing needs new Session events / Host Remote and is deferred.

Spec: [`docs/superpowers/specs/2026-09-08-orchestrator-evidence-participation-highlight-design.md`](../../../../docs/superpowers/specs/2026-09-08-orchestrator-evidence-participation-highlight-design.md).

## Alternatives considered

- **Fiber mount / `active` as participation** — rejected; mount ≠ turn evidence and would light silent spine plugins.
- **Full Cordis call tracing** — deferred; requires core Session event / Remote changes beyond this plugin.
- **Generated tool-catalog as the only map** — deferred for tool aliases; event→module table ships curated and exact.

## Consequences

- Silent composition units without tool or curated-event evidence remain dark by design.
- Expanding coverage means adding Session event types to `participation-map` (or later generating from catalogs), not inferring from Loader state.

## Testing

- `pnpm --filter dsh-agent-orchestrator exec vitest run` (participation-map, derive turnModuleNames, withLiveActivity module paint).
- `pnpm --filter dsh-agent-orchestrator bundle`.

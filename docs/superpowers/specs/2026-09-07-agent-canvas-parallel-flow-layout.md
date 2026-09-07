# Parallel tool columns on agent-canvas flow

English | [中文](2026-09-07-agent-canvas-parallel-flow-layout.zh.md)

**Status:** approved (2026-09-07)

**Scope:** `plugins/agent-canvas` flow layout only (option A: sibling tool calls from one assistant message)

## Decision

Within a step band, place pipeline columns left-to-right:

`Step → Model → [tools stacked vertically] → Join (if 2+ tools)`

One tool stays a single column (no Join). Topology already fans Model→tools→Join in `derive-flow`; this change is layout + `kind: 'join'`.

Does **not** reflect exclusive vs parallel-safe runtime scheduling.

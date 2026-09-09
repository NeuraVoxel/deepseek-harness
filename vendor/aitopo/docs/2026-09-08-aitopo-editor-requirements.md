# AITopo Editor requirements (for dsh-agent-orchestrator)

**Status:** accepted (2026-09-09); Editor milestone implemented (engine + demo)
**Package:** `@neuravoxel/aitopo`
**Consumer:** [`plugins/agent-orchestrator`](../../../plugins/agent-orchestrator/docs/2026-09-08-agent-orchestrator-design.md)
**Base design:** [2026-09-07-aitopo-design.md](./2026-09-07-aitopo-design.md)
**Implementation plan:** [2026-09-09-aitopo-editor-implementation-plan.md](./2026-09-09-aitopo-editor-implementation-plan.md)

## Summary

Phase 1 AITopo is observation-grade (pan/zoom, select/activate, load/apply). `dsh-agent-orchestrator` needs an **Editor milestone**: graph mutations driven by interactions that emit `GraphPatch` / `GraphEvent`, without React, Cordis, or harness types inside the engine. The orchestrator remains the source of truth for composition; AITopo remains the stage.

This document revises Phase 1 non-goals that blocked editing (undo ownership, editor interactions) **without** making the graph the agent orchestration source of truth.

## Non-goals (still)

- React bindings (plugin hosts remain responsible).
- Harness / Cordis / `@deepseek-ai/dsh-*` imports.
- PropertyBox, GIS, DXF, HTML-in-node widgets, Overview as a required widget.
- Interpreting orchestrator or preset semantics inside the engine.

## Requirements

| ID | Priority | Requirement | Motivation | Suggested contract |
|---|---|---|---|---|
| **AT-E1** | P0 | Node drag move | Reposition composition nodes; drag within canvas | `MoveNodeInteraction`; continuous optional preview; commit `updateNode` positions; emit `nodeMoved` (id, from, to) on pointer-up |
| **AT-E2** | P0 | External drop hit | Catalog HTML → canvas add | Pointer `externalDrop` (or equivalent) with scene coordinates + opaque `data` string/bytes from DataTransfer; engine does not parse payload |
| **AT-E3** | P0 | Group membership edit | Drag into / out of composition band | Interaction + patches updating `GraphGroup.memberIds`; emit `groupMembershipChanged` |
| **AT-E4** | P0 | Group stroke styles | Distinguish composition vs catalog bands | `GraphGroup` style fields for stroke dash / width / color; Canvas2D respects them |
| **AT-E5** | P0 | Locked / non-interactive nodes | Core rows cannot move or leave composition | `locked?: boolean` (or `interactive: false`) on nodes; move/membership interactions skip locked targets |
| **AT-E6** | P1 | Marquee selection | Bulk enable/disable in the shell | `MarqueeSelectInteraction`; updates selection via existing `setSelection` |
| **AT-E7** | P2 | Create / delete edges | Optional dependency edges for future kinds | `CreateEdgeInteraction`; `edgeCreated` / edge remove via patch; skip if product kind unused |
| **AT-E8** | P1 | Undo / redo policy | Orchestrator edit reversibility | Optional in-engine `PatchHistory` (push applied patches, `undo`/`redo` → inverse apply); host may own its own stack; protocol patches remain the unit of history |
| **AT-E9** | P0 | Demo + README | Prove editor loop without the plugin | Vanilla demo: move, drop stub, dashed group, lock; README lists Editor interactions and events |

### Event / patch expectations

- Every committed editor gesture that changes the document is expressible as `GraphPatch` ops already in the protocol, or as additive ops defined in the same Editor design revision.
- Events are structured and stable enough for a React host to mirror into an Orchestration Document.
- Failed patch apply leaves the scene unchanged (existing engine contract).

### Interaction attachment

Keep `Interaction.attach(network) => disposer`. Editor interactions compose with `PanZoomInteraction` and `SelectActivateInteraction` without forking Network.

## Acceptance

Editor milestone is done when:

1. Unit tests cover AT-E1–E5 (and AT-E6/E8 per chosen priority).
2. Demo exercises move, external drop stub, dashed group, locked node skip.
3. No React / DSH dependencies in `@neuravoxel/aitopo`.
4. Orchestrator F1 can enable edit chrome solely through public Network APIs (feature detection or semver).

## Mapping to orchestrator phases

| Orchestrator | Requires |
|---|---|
| F0 read-only | Current engine (no Editor milestone) |
| F1 editable commit | AT-E1–E6, AT-E8, AT-E9 |
| F2 richer kinds | AT-E7 as needed |

## Decisions (locked in implementation plan)

| Topic | Choice |
|---|---|
| Event names | Dedicated `nodeMoved`, `groupMembershipChanged`, `externalDrop` |
| Drop target | Free canvas + opaque payload; host decides `addNode` / membership |
| AT-E8 | Optional in-engine `PatchHistory` (inverse patch apply); host may own its own stack |
| Marquee | Shift+empty-space drag (unmodified empty drag stays pan) |
| `locked` | First-class `GraphNode.locked?: boolean` |
| Design reference | `vendor/SDK2D/twaver/vector/` ideas only (DefaultInteraction live move / rect-select / movable gate / GroupUI outline styles / UndoManager → PatchHistory). Clean-room: no SDK2D import or twaver API names |

See the [implementation plan](./2026-09-09-aitopo-editor-implementation-plan.md) for the full reference map, file map, and tasks.

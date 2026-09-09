# Agent Note: AITopo Editor interactions (move, drop, marquee, PatchHistory)

Status: proposed

English | [中文](2026-09-09-aitopo-editor-interactions.zh.md)

## Problem

Phase 1 `@neuravoxel/aitopo` is observation-grade (pan/zoom, select/activate, load/apply). `dsh-agent-orchestrator` F1 needs graph mutations from canvas gestures—node move, catalog drop, composition membership, marquee select, and reversible patches—without React, Cordis, or harness types inside the engine, and without copying `vendor/SDK2D` / twaver APIs.

## Proposal

Ship an Editor milestone on the existing dual-face Network / Interaction surface:

1. Dedicated `GraphEvent` discriminants: `nodeMoved`, `groupMembershipChanged`, `externalDrop` (not only `documentChanged` metadata).
2. Optional protocol-level `PatchHistory` (forward/inverse `GraphPatch` pairs); hosts may ignore it and own their stack.
3. Marquee via **Shift+empty-space** drag; unmodified empty drag stays pan.
4. First-class `GraphNode.locked` and `GraphGroup.style` (`strokeDash` for composition bands).
5. Clean-room reference to `twaver.vector` ideas only (live move, movable gate, rect-select overlay, group outline styles, UndoManager → patches)—no SDK2D imports or twaver public names.
6. Free-canvas `externalDrop`: engine emits scene `{ x, y }` + opaque MIME payload; **host** decides `addNode` / membership.

Requirements: [vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md](../../../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md). Plan: [vendor/aitopo/docs/2026-09-09-aitopo-editor-implementation-plan.md](../../../../vendor/aitopo/docs/2026-09-09-aitopo-editor-implementation-plan.md). Related: [dual-face canvas engine](2026-09-07-aitopo-dual-face-canvas-engine.md).

## Alternatives considered

- **Only `documentChanged` for edits.** Rejected: orchestrator hosts need structured move/drop/membership payloads without re-diffing the full document.
- **Engine auto-`addNode` on drop.** Rejected: catalog semantics belong to the host; engine stays payload-opaque (`text/plain`, then `application/aitopo-drop`).
- **Mirror twaver `UndoManager` property listeners.** Rejected: history unit is `GraphPatch` so models and hosts share one stack vocabulary.
- **P-key chord for group reparent (twaver).** Rejected: Editor contract uses automatic group hit on move end for orchestrator drop-into-band.
- **Separate `setEditInteractions` API names.** Rejected: pack editor modules via `Network({ interactions: […] })` appended to defaults.

## Acceptance criteria

- Unit tests cover AT-E1–E6 and AT-E8; fixture `editor.json` parses.
- Demo **Editor** mode attaches Move / ExternalDrop / Marquee **in addition** to defaults; observation Fleet/Flow/Teams remount without editor interactions.
- Status line surfaces `nodeMoved` / `externalDrop` / `groupMembershipChanged`; drop stub host-applies `addNode`; Undo/Redo via `PatchHistory`.
- No React, Cordis, or `@deepseek-ai/dsh-*` in the engine package; no `twaver` / `SDK2D` imports under `vendor/aitopo/src`.

## Risks

- Gesture composition (move vs select vs pan vs Shift-marquee) can fight if attach order or thresholds drift; mitigate with documented Shift-marquee and 4px drag threshold.
- Wrapping `apply` for demo undo can surprise hosts that also subscribe to every apply; production hosts should construct `PatchHistory` explicitly rather than monkey-patching.
- Orchestrator still maps `unit.locked` → `GraphNode.locked` in a follow-up; engine `locked` alone does not wire the plugin.

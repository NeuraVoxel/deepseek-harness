# Agent Note: agent-canvas harness frame nodes (Profile / Session / Envelope / Memory / Context)

Status: implemented

English | [中文](2026-09-08-agent-canvas-harness-flow-nodes.zh.md)

## Problem

The agent-canvas process view showed only the Agent Loop pipeline (`client-input → host-admit → step → model → tool → join → turn-end → client-render`). Operators could not see the harness concepts that actually decide what the model receives: boot Profile composition, Session identity, the logged request envelope (system + tools + call config + preset), Session-surface Memory (including compaction), and per-step LLM Context assembly.

## Decision

Extend `plugins/agent-canvas` flow derivation only (no `packages/` changes):

- Prelude: **Profile** (boot composition; Client cannot read the Host profile name) → **Session** (id / lifecycle) → **Envelope** (evidence from `agent-preset/selected` + latest `request/header` / `EpochHeader`: tools, system, model). The canvas kind is `envelope`, not a invented Resource layer — harness has no Resource service.
- Each step: **Memory** (Session surface message count + compaction bracket / compact summary; label states there is no Memory service) → **Context** (`request/header` + non-user `user/message` injections; compact summaries stay on Memory) → existing Step → Model → Tools.
- Edges: Session → Client input; **admit → Context** (control); **Memory → Context** and **Envelope → Context** (data feeds); Host pipeline continues Context → Step → …
- Edge kinds: `flow` (step/control, gray) vs `data` (payload into Context, teal); AITopo `drawEdge` reads `data.stroke` / `strokeHover` / `lineWidth`.
- Client-input nodes include only `source.kind === 'user'` prompts so context injections are not double-counted as user input.
- Turn/step membership uses `turn/start`…`turn/end` and `step/start`…`step/end` seq ranges because surface messages omit `turn` / `step` fields.
- The IO inspection panel is pointer-interactive (`user-select`, copy, scroll); pointer events stop at the panel so the canvas does not pan or clear selection during text selection.

## Alternatives considered

- **Separate Architecture view.** Rejected for this change: one Hybrid turn flow keeps operators on the live turn they already open by double-click.
- **Invent a Memory service node.** Rejected: the repo has no Memory package; the canvas must name Session surface + compaction.
- **Label the envelope node Resource.** Rejected after review: Resource is not harness vocabulary; **Envelope** matches `request/header` / EpochHeader.
- **Host Remote for Profile name.** Deferred: useful later, not required to show the frame with honest Client-unknown detail.

## Consequences

- Flow layout prelude band label is `Harness → Host`; paint/locale/legend cover the five new kinds (`envelope` among them).
- Envelope stays `pending` until a header or preset event exists; Context stays assembling until header or injections appear.
- Required verification: `pnpm --filter dsh-agent-canvas test` (derive-flow + layout + aitopo adapters).

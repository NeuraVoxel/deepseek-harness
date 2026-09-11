# Agent Note: Agent Flow multi-dimension tabs

Status: proposed

## Problem

The Observe Flow canvas exposes a single process topology (`derive-flow`: Client → Host Frame → Step N). That view is useful for one Turn’s pipeline, but it cannot alone teach or show the harness from other durable angles—end-to-end Client↔Host↔persistence, Turn/Step recirculation, capability seams (Definition / Provider / Consumer) nested under tools, or the authoritative SessionEvent log. The product keeps evolving, so no single fixed diagram will stay correct; the UI needs several replaceable dimension views that can be researched and iterated without collapsing Fleet navigation or rewriting Host packages.

## Proposal

Keep Fleet | Flow navigation. Inside Flow only, add an ordered dimension tab strip. Each dimension is a small module behind a shared registry. Skeleton graphs are TypeScript constants with conservative live overlays from the focused Turn’s Session events. Ship five dimensions in v1; keep the current process flow as the default first tab.

### Information architecture

- Outer modes stay `fleet` | `flow` in `nav-store`.
- Entrances unchanged: Turn assistant-actions “Open Observe”, Fleet double-click → Flow.
- Flow chrome row 1: back to Fleet, Turn title, Jump to latest, zoom (existing habits).
- Flow chrome row 2: dimension tabs (default `process`).
- `focusTurn` remains shared across dimensions; switching tabs does not clear the pin.
- `nav-store` gains `dimension: FlowDimensionId` (remembered per Session scope; not URL-deep-linked in v1).
- Empty-canvas double-click returns to Fleet only on graph dimensions; the events dual-pane does not bind that gesture.

| Order | id | Role |
|------:|----|------|
| 1 | `process` | Existing per-Turn process pipeline |
| 2 | `panorama` | End-to-end Client ↔ Host ↔ Session ↔ Model/Tools ↔ render skeleton + overlay |
| 3 | `loop` | Turn / Step recirculation and settle |
| 4 | `seam` | Capability triangle with a `tools/*` nested example |
| 5 | `events` | Dual-pane SessionEvent timeline + payload |

Shared context every dimension may read: `sessionId`, `focusTurn` / `latestTurn`, Session event window, session lifecycle snapshot, locale `t`, and selection (`nodeId` / `eventId`). v1 linkage is primarily events → optional `linkedNodeId` (and apply that selection when switching to a graph dimension). Graph → events back-link may follow later.

### Dimension module contract

New tree under `src/client/flow-dimensions/`:

- `types.ts` — `FlowDimensionId`, `FlowDimensionContext`, view result union
- `registry.ts` — ordered registration
- `process/` — thin wrapper over existing `derive-flow` + `layout-flow` + `flow-to-document`
- `panorama/`, `loop/`, `seam/` — TS skeleton + `overlay(ctx)` status mapping
- `events/` — dual-pane UI (not only a `GraphDocument`)

```ts
type FlowDimensionId =
  | 'process' | 'panorama' | 'loop' | 'seam' | 'events'

interface FlowDimensionContext {
  sessionId: SessionId
  focusTurn: number | null
  latestTurn: number | null
  window: SessionEventWindow
  session: SessionSnapshot
  t: PropsLocaleTranslator // same locale face FlowPane already receives
  selection: { nodeId: string | null; eventId: string | null }
}

type FlowDimensionView =
  | {
      kind: 'graph'
      document: GraphDocument
      /** Optional per-node inspector payloads (process flow reuses input/output text). */
      inspectByNodeId?: Map<string, { inputText?: string; outputText?: string; detail?: string }>
    }
  | {
      kind: 'events'
      entries: readonly EventListEntry[]
      selected: EventListEntry | null
      linkedNodeId?: string
    }

type FlowDimensionModule = {
  id: FlowDimensionId
  labelKey: string
  derive(ctx: FlowDimensionContext): FlowDimensionView
}
```

`FlowPane` loads the active module from the registry, calls `derive` once per relevant input change, and hosts either `AITopoHost` or the events dual-pane. Process-flow legend and inspector behavior stay for `process`; skeleton dimensions use a shorter status legend.

### Per-dimension content

**`process`** — Unchanged semantics of `deriveAgentFlow` / `flowToDocument`. Purpose: what stages this Turn actually ran.

**`panorama`** — Skeleton bands such as Client (Web/CLI) → Host admit / Profile → Session + Envelope → Context assembly → Model ⇄ Tools → Session durable write → Client render, with an optional muted subagent/preset spur. Overlay sets `pending|active|done|error` from the focus Turn; multi-step Model/Tools show aggregate detail (current step or completed step count), not a full per-step expansion (that remains `process`).

**`loop`** — Recirculating layout: `turn/start` → `step/start` → request/context → model → (tools aggregate) → `step/end` → back or `turn/end`. Overlay shows Turn number, completed step count, in-loop vs settled, and `TurnEndReason` when present. Tool fan-out collapses to a Tools×N node so the ring stays readable.

**`seam`** — Capability triangle Definition → Provider → Consumer, with a nested `tools/*` example (schema registration → provider execution → tool consumer). Overlay is conservative: highlight only when events prove a tool name or known LLM route; never invent unobserved providers. Skeletons remain hand-maintained TS constants so research can revise the lesson without scanning `packages/`.

**`events`** — Left: chronological SessionEvent list for the focus Turn (or latest when unpinned), with simple type chips (e.g. surface vs control). Right: selected event payload/summary and any linked node hint. Purpose: authoritative log under the diagrams.

**Overlay rule (all skeleton dimensions):** light a node only with evidence; unmapped nodes stay explanatory gray. Status enum matches process flow: `pending | active | done | error`. Event→node maps live beside each dimension module and change with the skeleton.

### UI and i18n

- Dimension labels, legends, and empty states go through the existing locale path (`locales` / `PropsLocale`); no hardcoded product copy in components.
- Events pane: roughly 36–40% width for the list, remainder for payload; top Turn chrome still applies.
- Selection state for cross-dimension hints lives with Observe nav/UI state for that Session scope.

### Testing

Owner-local package tests only (no harness recorded-session requirement for this plugin-only UX):

- Registry: five ids in order; default `process`.
- Each skeleton overlay: fixture events → expected node statuses, including “no mapping stays gray”.
- Events: Turn filtering, selected payload, `linkedNodeId` when a map hits.
- Existing `derive-flow` / `flow-to-document` specs remain green.
- No mandatory full-page React snapshots.

### Delivery

- Branch: `observe/flow-dimensions` (plugin-only; do not modify `packages/` or `vendor/aitopo`).
- Acceptable incremental land: tab shell + `process` wrapper first; other dimensions ship readable skeletons, then thicken overlays.
- Merge when the maintainer is satisfied with the learning/observation value.

### Non-goals

- Editable canvas or remote/diagram config files (skeletons stay TypeScript).
- Auto-scanning the monorepo to generate the capability-seam graph.
- Collapsing Fleet into a sixth dimension or replacing outer Fleet|Flow.
- URL deep links to a dimension.
- Full bidirectional graph ↔ events sync in v1 (events → selection hint only).
- Cross-Session compare or a separate recording scrubber.

## Alternatives considered

- **Live-only tabs (no teaching skeletons):** rejected — cannot explain seams and recirculation that a single derived pipeline under-represents, and every research change would require inventing more event-derived structure.
- **Teaching-only static diagrams (no live overlay):** rejected — Observe’s value is Session-backed; hybrid keeps evidence on the skeleton.
- **Hard-branch `switch` inside `ObserveView` without a dimension registry:** rejected for v1 multi-tab scope — five views plus an events dual-pane would bloat `FlowPane` and make iteration costly.
- **One generic “annotated graph engine” for all five dimensions:** rejected while diagrams are still under research — events and seams are not the same source shape; premature unification costs more than a thin registry.
- **Data-file (JSON/YAML) skeletons:** rejected for v1 — TypeScript constants match `derive-flow`, stay typed, and ship with the plugin; files can be reconsidered if copy churn dominates logic churn.
- **Promote dimensions to Observe top-level (Fleet as just another tab):** rejected — keeps the existing Fleet drill-in mental model and Turn pin behavior.
- **Four dimensions without events, or events as timeline-only / causality-graph-only:** rejected — dual-pane timeline + payload is the chosen under-diagram authority; a pure causality graph duplicates topology tabs.

## Acceptance criteria

- From Flow, five dimension tabs appear in the order above; default is `process` with behavior equivalent to today’s process canvas for the same Turn pin.
- `focusTurn`, Jump to latest, and return-to-Fleet (graph empty double-click) behave as today across dimension switches; events pane does not use empty double-click to leave Flow.
- `panorama`, `loop`, and `seam` render TS skeletons and apply overlays only where event evidence exists.
- `events` shows a Turn-filtered list and a payload pane; selecting an event may set a linked node id used when switching to a graph dimension.
- Dimension copy is locale-owned; package unit tests cover registry, overlays, and events selection mapping; `packages/` and `vendor/aitopo` remain untouched.

## Risks

- Skeleton overlays can drift from Host reality as the harness evolves — mitigated by conservative mapping and treating gray nodes as intentional teaching state, not failures.
- Five tabs increase chrome density on small widths — mitigated by a compact second-row tab strip and shorter legends on skeleton dimensions.
- Event→node maps are hand-maintained and can go stale when skeletons change — accepted; maps live next to each dimension module so updates stay local.
- Capability-seam live highlight will often be sparse — accepted; the tab’s primary job is the design lesson, not a complete runtime inventory.

## Implementation plan

Temporary checklist for this branch (delete or fold into Consequences when the note moves to `implemented/`).

1. **Shell** — `nav-store.dimension` + `setDimension`; locale keys for five tabs; `FlowPane` second-row tab strip; blank double-click still Fleet-only on graph dims.
2. **Registry** — `src/client/flow-dimensions/{types,registry}.ts`; `process/` wraps existing `derive-flow` + `flowToDocument`.
3. **Context inject** — expose Session `eventSource` + `session` snapshots beside `agentFlow` so skeleton/events dims can read durable events without Host changes.
4. **Skeletons** — `panorama`, `loop`, `seam` TS graphs via shared skeleton→`GraphDocument` helper; conservative overlays + unit tests (including unmapped gray).
5. **Events** — dual-pane list + payload; Turn filter; optional `linkedNodeId` into selection when switching dims.
6. **Docs/tests** — README mention of five dims; package `test` + `typecheck` + `verify-notes`.

# Agent Note: Observe DataFlow dimension tab

Status: implemented

## Problem

Architecture teaches harness structure with an abstract Turn/Step loop; Process shows Host teaching stations; Events lists authoritative Session payloads. None alone answers “how did real data move through this Turn’s end-to-end path and each real Step until the UI rendered?” Reusing Process topology for DataFlow left the canvas looking like Process with only inspector text changed.

## Decision

Flow includes a **`dataflow`** tab (locale: 数据流 / Data flow) alongside Process. Tab order: Architecture → Data flow → Process → Events. Default remains Architecture. Shared `focusTurn` is unchanged.

DataFlow does **not** reuse Process topology. It builds its own graph:

1. **End-to-end Group** — same spine idea as Architecture panorama (`Client → admit → Session → Model ↔ Tools → Session write → Client render`), with Session-backed inspect and short payload edge labels (`session.prompt`, `assistant`, `session.follow`, …).
2. **Real N×Step Group** — replaces Architecture’s single abstract Turn/Step loop. For each `step/start` in the focused Turn, emit a Step band: `step/start → request assemble → Model → [Tools group with real tool nodes above/below the trunk slot] → step/end`. No standalone Tools hub node. Tool results rejoin `step/end`, append to Session write (`surface`), and when another Step follows, feed that Step’s request (`tool.result → next` / `surface → next`). Bracket with `turn/start` / `turn/end`. Step-internal control edges stay visible; E2E↔Step bridges are optional via `showDataFlowControlEdges`.
3. **Model** is the hub on both E2E (overview) and each Step (request in / `assistant/message` out).
4. **Event beads** — shared `appendTurnEventBeads` with Step-first anchors (`createDataFlowEventAnchorResolver`); reuses Architecture `focusEventBeads`. See [DataFlow Turn event beads](./2026-09-12-dataflow-event-beads.md).

Inspector fields bind Session events only (`organizedText` when useful). Process teaching Remote / `llm.stream` prose is never used as DataFlow payload text.

### Projection ownership

| Module | Responsibility |
|---|---|
| `flow-dimensions/dataflow/build-graph.ts` | E2E + N×Step `GraphDocument` |
| `flow-dimensions/dataflow/project-inspect.ts` | Session-backed `FlowNodeInspect` |
| `derive-flow` | Process only (unchanged) |
| Architecture / Process / Events | Unchanged roles |

### Related

Partially extends [Agent Flow multi-dimension tabs](../../proposed/feature/2026-09-11-flow-dimension-tabs.md). Architecture keeps the abstract loop skeleton; DataFlow expands real Steps for the focused Turn.

## Alternatives considered

- **Thin wrapper over Process (same IO, new label):** rejected — teaching prose masquerades as data; canvas identical to Process.
- **Reuse Process topology with payload inspect only:** rejected after shipping — operators could not tell DataFlow from Process; user redirected to E2E + real N×Step.
- **Replace or rename Process into DataFlow:** rejected — Process remains the Host/mechanism pipeline view.
- **One node per SessionEvent instance:** rejected — graph explosion; Events already owns the timeline.
- **Module-ownership diagram (Client / SessionController / agent-loop packages):** rejected for v1 — weaker at answering “what payload moved this Turn.”

## Consequences

- DataFlow canvas structure tracks Architecture E2E + real Step events, not Process stations (no Join / Profile / Memory teaching nodes).
- Multi-step Turns grow vertically (one band per Step); very large tool fan-out may need later layout polish.
- Operators use Architecture for abstract loop teaching, DataFlow for this Turn’s real Step expansion and payloads, Process for Host mechanism copy, Events for the raw log.

## Testing

- `dimensions.spec.ts`: completed Turn fixture asserts E2E + `g-df-step-1`, `df:s1:start|request|model|end`, tool node, real payload substrings, absence of Process teaching phrases; control-edge toggle reveals E2E↔Step flow bridges and turn brackets stay present.
- `registry.spec.ts`: tab order includes `dataflow` after Architecture.

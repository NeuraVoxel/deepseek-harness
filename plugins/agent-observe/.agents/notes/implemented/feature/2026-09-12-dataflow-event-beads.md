# Agent Note: DataFlow Turn event beads

Status: implemented

## Problem

Architecture already overlays Turn-scoped event beads (1:1 with the Events tab filter `all`) via shared `appendTurnEventBeads`, with optional `focusEventBeads` dimming. DataFlow shows the same Turn’s E2E spine and real Step bands with Session-backed inspect, but previously omitted beads, so operators could not see durable event order on the payload path without switching to Architecture or Events.

## Decision

DataFlow reuses the shared bead pipeline. `resolveAnchor` receives the current `SessionEvent`. Architecture resolvers ignore it. `createDataFlowEventAnchorResolver` tracks the latest `step/start` and prefers Step-trunk / tool nodes, then Turn brackets / E2E:

| Event / linked role | Preferred anchor | Fallback |
|---|---|---|
| `turn/start` | `df:turn:start` | `df:e2e:admit` (Architecture `admit`) |
| `turn/end` | `df:turn:end` | `df:e2e:admit` (Architecture `admit`) |
| `step/start` / `step/end` | `df:sN:start` / `df:sN:end` | `df:e2e:session` (Architecture `context`) |
| `request/*` | `df:sN:request` | `df:e2e:session` (Architecture `envelope`) |
| `assistant/message` | `df:sN:model` | `df:e2e:model` |
| `tool/call` · `tool/result` | `df:sN:tool:{callId}` when present | `df:sN:model` → `df:e2e:tools` |
| `user/message` | `df:e2e:client` | — |
| `system/message` / unmapped | — | `df:e2e:write` (Architecture `durable`) |
| Other linked E2E roles | `EVENT_ANCHOR_DATAFLOW_E2E` (panorama-aligned) | write / session / admit |

`EVENT_ANCHOR_DATAFLOW_E2E` mirrors `EVENT_ANCHOR_PANORAMA` onto DataFlow’s coarser spine (`envelope`/`context`/`preset` → `session`, `durable` → `write`). Events with no Turn/Step host still produce a bead on the E2E spine so the Events-tab Turn list stays 1:1 with DataFlow beads.

`deriveDataFlowDimension` appends beads after graph build, merges bead `groupId`s into group `memberIds`, and applies `applyEventBeadFocus` when `focusEventBeads` is set. The DataFlow toolbar exposes the same focus control; the legend reuses Architecture bead swatch locale keys.

## Alternatives considered

- **E2E-only anchors (Architecture panorama style):** rejected — DataFlow’s teaching value is the real Step bands.
- **Duplicate DataFlow-local bead appender:** rejected — would fork stack/paint/seq/focus behavior.
- **Precomputed `Map<seq, anchorId>` without changing `resolveAnchor`:** rejected — more indirection than passing `event`.
- **Always-on beads with no focus control / separate DataFlow focus state:** rejected — keep Architecture’s shared focus control.

## Consequences

- Dense Turns still stack beads beside Step nodes (same rule as Architecture).
- Unmapped Events-tab types land on `df:e2e:write` (Architecture `durable` stand-in), so bead count matches the Events list for the focused Turn.
- DataFlow E2E role map stays aligned with Architecture panorama where stages exist; missing `envelope`/`context`/`preset` collapse to `session`.
- Extends [Observe DataFlow dimension](./2026-09-12-observe-dataflow-dimension.md).

## Testing

- `dimensions.spec.ts`: DataFlow beads on `df:turn:start` / `df:e2e:client` / `df:s1:model` / `df:s1:tool:c1`; multi-Step assistants on owning `df:sN:model`; `system/message` on `df:e2e:write`; E2E-only Turn maps `request`→`session` and `turn/end`→admit role; bead count matches Events `all`; `focusEventBeads` dims non-bead chrome.
- Architecture bead tests remain green with the extended `resolveAnchor` signature.

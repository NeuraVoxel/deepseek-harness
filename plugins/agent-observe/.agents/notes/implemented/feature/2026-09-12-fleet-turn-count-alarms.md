# Agent Note: Fleet Turn-count Alarm badges

Status: implemented

## Problem

Fleet nodes showed lifecycle chrome (running / idle / cold / archived) but not how much conversation each Session had completed. Operators needed the real Turn count at a glance without opening each Session’s Flow tab.

## Decision

Each Fleet node paints an AITopo **AlarmAttachment** at the body top-right when `AgentObserveNode.turnCount` is known:

- Badge **message** is the decimal Turn count (AlarmAttachment paints `message` inside the circle).
- Badge **level** is `warn` (warm orange), never `error` / red — Process/skeleton failure alarms stay on `error`.
- **Client** (`deriveClientTopology`): `blank` → `0`; otherwise `projectionValues.sessionStats.turns` when present; omit the field (no badge) when the list has no evidence yet.
- **Host** (`buildLiveTopology`): max `turn/start` turn from `session.snapshotEvents()` when available (including `0` for empty logs).

AITopo alarm fills use a warm palette on dark canvases (`warn` / `info` amber-orange; `error` stays orange-red for failures).

## Alternatives considered

- **Label2 / meta text for the count:** rejected — user asked for Alarm attachment placement and chrome.
- **`error` level for visibility:** rejected — must not read as a failure; warm `warn` is enough.
- **Always fetch every Session log on the Client Fleet path:** rejected — list already carries `sessionStats` when the projection unit is mounted; full-log fan-out is too heavy for the overview.

## Consequences

- Sessions without `sessionStats` on the Client list show no Turn badge until projections arrive (blank still shows `0`).
- Host Remote `snapshot()` and Client-derived Fleet can disagree slightly: Host counts started Turns; `sessionStats.turns` counts Turns with at least one closed Step.

## Testing

- `derive-topology.spec.ts`: blank / sessionStats / unknown Turn projection.
- `adapters.spec.ts`: `turnCount` → `warn` alarm message on Fleet documents.
- `topology.spec.ts`: Host `turn/start` fold.
- aitopo `node-attachments.spec.ts`: alarm paint op carries badge `text`.

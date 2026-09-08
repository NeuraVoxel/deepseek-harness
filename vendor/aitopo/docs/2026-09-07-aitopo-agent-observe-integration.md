# AITopo ↔ agent-observe integration

**Status:** approved (2026-09-07)
**Audience:** plugin authors adapting `plugins/agent-observe`
**Engine design:** [2026-09-07-aitopo-design.md](./2026-09-07-aitopo-design.md)
**Plan:** [2026-09-07-aitopo-implementation-plan.md](./2026-09-07-aitopo-implementation-plan.md) Part II (Chunks 12–13)

## Summary

Replace the SVG fleet/flow drawing path in `plugins/agent-observe` with `@neuravoxel/aitopo`. Ship Fleet and Flow in one change; map Agent Teams to SubNetwork when membership data exists; delete SVG rendering and `use-canvas-viewport`. No feature flag and no SVG fallback.

## Decisions

| Topic | Choice |
|---|---|
| Scope | Chunk 12 + 13 together |
| Renderer switch | AITopo only; remove SVG / ZoomStage / `use-canvas-viewport` |
| Feature flag | None |
| Adapter home | `plugins/agent-observe/src/client/aitopo/` |
| Engine purity | No React, Session brands, or Cordis inside `@neuravoxel/aitopo` |
| Layout | Keep plugin `layout.ts` / `layout-flow.ts`; write x/y into `GraphDocument` before `load` |
| Teams | When `teamId` data exists → `networks` + dblclick enter; else keep unavailable hint |

## Architecture

```
derive-topology / derive-flow  (unchanged)
        │
        ▼
snapshot-to-document / flow-to-document / alarms-from-status
        │  GraphDocument (plain strings; no SessionId)
        ▼
AITopoHost (React) ── mount / destroy / load / apply / on(GraphEvent)
        │
        ▼
@neuravoxel/aitopo Network (Canvas 2D, dirty-rect, pan/zoom/select)
```

`ObserveView` keeps the toolbar, group mode, legends, empty states, and Flow back navigation. Only the stage is `AITopoHost`.

## Files

| Path | Role |
|---|---|
| `AITopoHost.tsx` | Div host: `useEffect` create `Network`, mount, subscribe, destroy; props for document, optional patch, event handlers, zoom toolbar bridge |
| `snapshot-to-document.ts` | `AgentObserveSnapshot` + group mode + labels → `GraphDocument` |
| `flow-to-document.ts` | `AgentFlowSnapshot` (+ layout positions) → `GraphDocument` |
| `alarms-from-status.ts` | Flow `error` → Alarm; map `active` / `running` to node status/style |
| Modify `ObserveView.tsx` | Wire Fleet/Flow to host; remove SVG glyphs / ZoomStage |
| Delete `use-canvas-viewport.ts` when unused | Camera owned by Network |
| `package.json` | Dependency `@neuravoxel/aitopo` (workspace) |
| README.md / README.zh.md | Document Canvas engine; drop twaver swap-in note |

## Mapping

### Fleet

- Node → `type: 'agent'`, id string from Session id, title/status/meta from snapshot.
- Edge → parent (and team when present).
- Groups → workspace / tree bands from existing `layoutTopology` geometry.
- Current session → style highlight (`current` / selection chrome via adapter style field).
- Click (`nodeActivated` detail click) → `openSession`.
- Double-click → `showFlow` (open session if needed). When group mode is teams and the node has a nested network, double-click may `enterSubNetwork` instead; Esc / toolbar exits when stack is non-root.

### Flow

- Nodes → `type` from kind (`step` / `tool` / …); positions from `layoutAgentFlow`.
- `status: 'error'` → Alarm (`level: 'error'`).
- `status: 'active'` → style/status highlight (parity with pulse CSS intent).
- Hover → `hoverChanged` drives the existing I/O tooltip (HTML overlay outside the canvas).
- Toolbar zoom ± / fit / reset call `AITopoHost` methods that forward to Network viewport.

### Teams

- If any node has `teamId`, build `doc.networks[teamId]` child documents and group by team; double-click enters.
- If Teams remote is absent (today’s placeholder), keep `group.teams.unavailable` note; no empty SubNetwork inventing.

## Event contract

| GraphEvent | Plugin action |
|---|---|
| `nodeActivated` (click) | Fleet: `openSession` |
| `nodeActivated` (dblclick) | Fleet: `showFlow` or `enterSubNetwork` |
| `hoverChanged` | Flow: tooltip; Fleet: optional no-op |
| `subNetworkChanged` | Update breadcrumb / exit affordance if needed |
| `viewportChanged` | Refresh zoom badge text |

## Error handling

- Invalid adapter output: fail loud in tests; production load throws → show empty/error strip using existing locale keys or a minimal new string (i18n if new copy).
- `Network.destroy` on unmount and before remount; no stacked RAF.
- Patch apply failures leave scene unchanged (engine contract).

## Testing / verify

1. Adapter unit tests: snapshot → document; flow error → alarm; round-trip ids are strings.
2. `pnpm --filter dsh-agent-observe bundle` succeeds with aitopo inlined or resolved per tsdown client rules.
3. Manual: Fleet open/dblclick flow; Flow hover tooltip; zoom fit; Teams path when fixture data present.
4. Product-visible GUI change: record browser GIF per `record-browser-gif` when opening a PR that changes the Canvas tab.

## Non-goals

- Feature flag / SVG coexistence.
- Model-visible `aitopo_*` tools.
- Multi-level SubNetwork beyond engine phase-1 single level.
- Moving Host topology types into the engine package.

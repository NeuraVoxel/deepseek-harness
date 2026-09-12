# Agent Note: Adopt AITopo GraphGroup expand defaults in Observe

Status: implemented

## Problem

AITopo shipped Group attachments with `expanded` omitted → **collapsed** (50×50 node, members hidden) and `autoFit` omitted → **true**. Observe still emitted layout bands without `expanded`, so Fleet / Flow groups would collapse after the engine bump. `pnpm --filter dsh-agent-observe bundle` also failed on `dimensions.spec.ts` under optional `GraphGroup.x`/`w` and stricter `SessionEvent` fixtures (`ToolResultMessage.role` is `'user'`).

## Decision

Observe adapts at the document boundary (no aitopo source edits):

- `observeLayoutGroup()` sets `expanded: true` and merges `DARK_FLOW_GROUP_STYLE` with `autoFit: false` so host layout geometry stays authoritative.
- `DARK_FLOW_GROUP_STYLE.label.maxChars: 0` aligns with AITopo’s group default (full titles; nested merge keeps `maxChars` when callers pass a partial `style`).
- All Fleet / Process / Architecture / DataFlow / skeleton group emitters go through that helper.
- Spec fixtures use `role: 'user'` for tool results and optional-geometry-safe midpoints.

## Alternatives considered

- **Ask aitopo to default `expanded: true`:** rejected for Observe — engine note already chose collapsed-by-default; hosts must opt in.
- **Leave autoFit on:** rejected — would ignore Observe’s explicit band `w`/`h` while expanded.

## Consequences

- Every Observe-emitted group is open at load; operators can still collapse via AITopo double-click if the interaction pack is enabled.
- Band size follows Observe layout, not member union, while `autoFit: false` remains set.
- Specs that assert group geometry must treat `x`/`w` as optional (engine protocol) even when Observe always supplies them.

## Aitopo follow-ups (optional, not blocking)

None required for this adopt. If many hosts need open bands without per-group flags, consider a document-level `meta.groupsExpandedByDefault` — propose upstream only if a second consumer needs it.

## Testing

- `flow-edge-style.spec.ts`: `observeLayoutGroup` open + `autoFit: false` + `label.maxChars: 0` survives partial style merge.
- `dimensions.spec.ts`: Architecture / Tools group `expanded`; Architecture group titles keep full locale keys (`maxChars: 0`).
- `pnpm --filter dsh-agent-observe bundle` / `pnpm test`.

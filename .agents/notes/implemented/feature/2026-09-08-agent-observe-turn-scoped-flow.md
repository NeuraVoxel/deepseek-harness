# Agent Note: agent-observe Turn-scoped flow from Chat shortcut

Status: implemented

English | [中文](2026-09-08-agent-observe-turn-scoped-flow.zh.md)

## Problem

The Observe Chat shortcut opened the Observe tab without pinning process flow to the Turn under the shortcut. Operators reviewing an older Turn lost that context when the Session advanced, and fleet double-click had no clear contract relative to a prior pin.

## Decision

Stay inside `plugins/agent-observe` (option 1 from the [Turn-scoped flow spec](../../../docs/superpowers/specs/2026-09-08-agent-observe-turn-scoped-flow.md)):

- Resolve Turn by scanning the Session binding for `assistant/message` whose `message.id` matches the shortcut `messageId`; on miss, open latest flow.
- Nav store adds `focusTurn: number | null` (`null` = latest). `showFlow(turn?)` pins or clears; `showLatest()` clears the pin and stays in flow; `showFleet()` clears the pin.
- `deriveAgentFlow` folds the pinned Turn; a missing Turn yields an empty placeholder without silently retargeting; live updates do not steal a historical pin.
- Flow toolbar shows **Jump to latest** when `focusTurn` is set and not the Session’s latest Turn.
- Fleet double-click always calls `showFlow()` (latest), independent of any prior pin.

The [composer view shortcuts](2026-09-08-composer-view-shortcuts.md) seat remains; Observe now consumes `messageId` for this reverse-lookup.

## Alternatives considered

- **Extend `AssistantActionOwnerProps` with `turn`** — rejected for this cut: Chat’s Turn tail already knows the number, but the change touches `packages/client/ui-chat` and breaks the plugin-only scope.
- **Silent retarget to latest when a pinned Turn is absent** — rejected: hides a missing referent; the empty placeholder is louder and keeps the pin honest.
- **Prev/next Turn controls or a Turn picker** — out of scope; Jump to latest is the only escape from a historical pin.

## Consequences

- No `packages/` edits; Turn identity depends on durable `assistant/message.id` matching the shortcut’s `messageId`.
- Pinned historical Turns keep their fold across live Session advances until the operator jumps to latest, returns to fleet, or double-clicks an Agent.
- Required verification: `pnpm --filter dsh-agent-observe test` (derive-flow pin/miss/latest, `resolveTurnFromMessageId` hit/miss, nav-store `showFlow` / `showLatest` / fleet clear).

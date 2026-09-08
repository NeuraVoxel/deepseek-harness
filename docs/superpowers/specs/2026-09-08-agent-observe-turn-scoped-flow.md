# agent-observe Turn-scoped flow from Chat shortcut

English | [中文](2026-09-08-agent-observe-turn-scoped-flow.zh.md)

**Status:** approved (2026-09-08)

**Scope:** `plugins/agent-observe` only (option 1: resolve Turn from `messageId` without extending `AssistantActionOwnerProps`)

## Product

- Click **Open Observe** on a finalized Turn’s assistant-actions row → open the Observe tab directly in **flow** mode for **that** Turn, and **pin** it.
- While pinned, newer Turns do **not** auto-steal the canvas.
- Flow toolbar shows **Jump to latest** when the pin is not the Session’s latest Turn; click clears the pin (`focusTurn = null`) and stays in flow.
- Fleet **double-click** always opens flow for the **latest** Turn (`focusTurn = null`), independent of any prior pin.

## Navigation store

Extend the Observe `nav-store`:

| Field | Meaning |
|---|---|
| `mode: 'fleet' \| 'flow'` | Existing |
| `focusTurn: number \| null` | `null` = display latest; number = pinned Turn |

Actions:

- `showFlow(turn?: number)` — enter flow; with a number, pin that Turn; omitted → `focusTurn = null` (latest).
- `showLatest()` — set `focusTurn = null`, remain in flow.
- `showFleet()` — return to fleet and clear the pin (avoids a stale pin on the next flow entry).

## Open Observe path

`ViewShortcut` receives `messageId` today and only clicks the Observe tab. Change to an inject callback `openObserveFlow(messageId)` closed over the Session binding + nav-store:

1. Scan the binding’s event window for `assistant/message` with `message.id === messageId`; take `data.turn`.
2. On miss → `showFlow()` (latest); still open the tab (no silent failure outside the UI).
3. On hit → `showFlow(turn)`.
4. `openConversationViewTab(localized Observe label)`.

Interrupted Turn tails without a durable `messageId` already omit assistant-actions; no new edge case.

## Flow derivation

`deriveAgentFlow(window, session, focusTurn?: number | null)`:

- `focusTurn == null` → same as today (`findLatestTurn`).
- Number present → fold `eventsInTurn(durable, focusTurn)`.
- If that Turn is absent from the log → empty / unavailable placeholder for Turn N; **do not** silently retarget `focusTurn` to latest.
- A pinned historical Turn that already has `turn/end` settles node status from that Turn even if the Session is running a newer Turn.

`createAgentFlowSource` re-projects when events, session lifecycle, **or** `focusTurn` change, so a pin holds across live updates.

## Flow toolbar

- Keep `flow.title` (`Turn {turn}`).
- When `focusTurn !== null` and `focusTurn !== latestTurn`, show **Jump to latest** → `actions.showLatest()`.
- Hide the control when already on latest (`focusTurn === null` or equal to latest).

Out of scope: prev/next Turn controls, Turn pickers, AITopo engine changes, Host topology Remotes, fleet layout changes.

## Why plugin-only `messageId` → Turn

Chat’s Turn tail already knows the Turn number, but extending `AssistantActionOwnerProps` with `turn` touches `packages/client/ui-chat`. This change stays inside the opt-in plugin and resolves Turn from the durable `assistant/message` that owns the shortcut’s `messageId`. Known limitation: identity depends on that id match; document it in the plugin README.

## Tests

Plugin vitest (no mandatory GUI e2e for this opt-in plugin):

- `derive-flow`: pinned historical Turn; missing Turn placeholder; `null` = latest; pin holds when a newer Turn appears in the window.
- `messageId` → Turn helper: hit and miss→latest.
- `nav-store`: `showFlow(n)` / `showLatest` / double-click `showFlow()`.

## Docs

- Update `plugins/agent-observe/README.md` + `.zh.md`: shortcut opens pinned-Turn flow; double-click = latest; Jump to latest; `messageId` reverse-lookup limitation.
- Same-PR Agent Note: why plugin reverse-lookup beat extending owner props for this cut.

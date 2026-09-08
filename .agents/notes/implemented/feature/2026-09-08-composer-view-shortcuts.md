# Agent Note: Composer shortcuts for Observe and Orchestrate tabs

Status: implemented

English | [中文](2026-09-08-composer-view-shortcuts.zh.md)

## Problem

Opt-in Observe and Orchestrate conversation tabs are easy to miss when the Session header tab ring is scrolled away or collapsed into chrome. Operators want a one-click jump from the Chat transcript without changing harness packages, and later need a seat that can carry per-Turn payload.

## Decision

Each plugin registers its own compact control on `conversation.chat.assistant-actions` (the turn-tail action row beside Turn usage / turn-cost), styled as a 28px circular icon:

- `dsh-agent-observe` → id `agent-observe`, order `30`, opens view id `observe`
- `dsh-agent-orchestrator` → id `agent-orchestrator`, order `40`, opens view id `orchestrator`

The owner prop `messageId` is accepted so plugins can resolve per-Turn payload without moving the seat. Observe consumes it for Turn-scoped flow ([Turn-scoped Observe flow](2026-09-08-agent-observe-turn-scoped-flow.md)); Orchestrate still opens its tab without using the id. Clicking the control finds the Session header `[role=tab]` whose visible label matches the plugin’s localized view label and clicks it, reusing the shell’s existing `selectView` path. Plugins do not write the Conversation View store: that handle is private to `ui-conversation`, and feature plugins must not import another feature package’s values.

## Alternatives considered

- **`conversation.input.dock` above the composer** — rejected for the product ask: shortcuts must sit under each Turn so future Turn payload has a natural host.
- **`conversation.input.right` beside ContextMeter** — rejected for the same Turn-scoped seating reason.
- **Harness `selectView` API on action props** — deferred; would be the durable seam, but requires `packages/` changes the request forbids.

## Consequences

- No `packages/` edits; shortcuts appear only when the corresponding plugin is patched or installed and the Turn has a durable closing `messageId`.
- Tab activation depends on the header tablist remaining in the document; label text must stay aligned with each view entry’s `label` thunk.
- Verification: `pnpm --filter dsh-agent-observe test`, `pnpm --filter dsh-agent-orchestrator test`.

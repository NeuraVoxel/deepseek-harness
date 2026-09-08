# Agent Note: agent-canvas harness frame nodes (Profile / Session / Envelope / Memory / Context)

Status: implemented

English | [中文](2026-09-08-agent-canvas-harness-flow-nodes.zh.md)

## Problem

The agent-canvas process view showed only the Agent Loop pipeline. Operators could not see harness concepts (Profile / Session / Envelope / Memory / Context), Client↔Host wire methods, or honest data vs control edges.

## Decision

Extend `plugins/agent-canvas` flow derivation only (no `packages/` changes):

- Layout bands: **Client · Web/CLI** (`Input → session.prompt → session.follow → Render`) → **Host · Frame · Turn N · preset** → **Host · Step N**.
- Wire nodes name real Typert Remotes: **`session.prompt`** (unary Client→Host) and **`session.follow`** (stream Host→Client). Carrier is Connection / Gateway; Host Cordis `session/event` and `agent/assistant-stream` stay process-local and are repackaged onto follow.
- Edges: Input → `session.prompt` → Host admit (`session.prompt`); Session + Model → `session.follow` → Render (`session.follow` / `assistant`); Memory/Envelope → Context → Model; Model/Tool → Session; admit → Context (flow).
- No `step` / `turn-end` graph nodes. Canvas "Context" = assembled GenerateOptions, not Cordis `Context` / `request/context`. Memory = Session surface + compaction.
- Client surface heuristic: `clientTimeZone` on user source → web; else cli.

## Alternatives considered

- **Invent BFF / SessionBinding / inbox wire nodes.** Rejected: not on-wire symbols; admit + Session already cover Host endpoints.
- **Label outbound path `session/event`.** Rejected: that bus is Host-local; wire frames are `session.follow`.
- **Separate Architecture view / Memory service / Resource node.** Rejected earlier; Envelope stays `request/header`.

## Consequences

- Legend includes remote-prompt / remote-follow.
- Required verification: `pnpm --filter dsh-agent-canvas test`.

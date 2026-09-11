# agent-observe

English | [中文](README.zh.md)

Opt-in plugin: a **Observe** tab beside Chat / Trajectory that shows Session / Agent topology.

- Nodes: every listed Session (Client list) with `running` / `idle` / `archived` status (`cold` reserved for Host or future Remote)
- Edges: subagent `parentId` links
- Groups: **Workspace** (default; columns left-to-right match the Harness Workspaces list), **Parent tree**, **Agent Teams** (SubNetwork when `teamId` exists)
- Click a node → `sessions.open(id)`
- **Open Observe** on a Turn’s assistant-actions row → Observe tab in **flow** mode **pinned** to that Turn (newer Turns do not auto-steal the canvas)
- Fleet **double-click** → process Canvas for that Agent’s **latest** Turn (`focusTurn = null`), banded as
  `Client · Web/CLI (Input · session.prompt · session.follow · Render) → Host · Frame → Host · Step N`
- Flow **double-click empty canvas** → back to Fleet (node/edge hits stay in flow)
- **Jump to latest** appears on the flow toolbar when pinned away from the Session’s latest Turn; click clears the pin and stays in flow
- **Limitation:** Turn is resolved from the durable `assistant/message.id` that owns the shortcut’s `messageId` (plugin reverse-lookup); this cut does not extend `AssistantActionOwnerProps` in `packages/`
- **Client↔Host wire nodes:** `session.prompt` (unary Remote) and `session.follow` (stream Remote); Host-local buses stay inside Host admit / Session
- **Harness nodes (honest to Host code):** Profile = boot composition (Client cannot read the profile name); Session = current log identity; Envelope = `request/header` EpochHeader (tools + call config) plus `agentPreset` (system prompt is `system/message` on the surface); Memory = Session surface + compaction (there is no Memory service); Context = per-step LLM request context (`request/header` + non-user `user/message` injections)
- **Turn / Step are band labels only** (title + `Host · Step N`), not graph nodes — Host admit is the Client→Host handoff; Context feeds Model
- **Edges:** gray **flow** = control / settle; teal **data** = payload (`Client input → Host admit`, `Session → Envelope`, `Memory/Envelope → Context`, `Context → Model`, `Model → Tool`, `Model/Tool → Session`, `Session → Client render`)
- Sibling tools from one assistant message stack in a **parallel column** and rejoin at Join
- Rendering: **[@neuravoxel/aitopo](../../vendor/aitopo)** Canvas Network (dirty-rect); no SVG stage

Does **not** modify `packages/` — mounts via patch / `dsh plugin`.

## Run

```sh
pnpm install
pnpm --filter dsh-agent-observe bundle
pnpm dsh web --patch ./plugins/agent-observe/cordis.patch.yml
```

Or install into a profile:

```sh
pnpm --filter dsh-agent-observe bundle
pnpm dsh plugin --profile web-observe-demo add ./plugins/agent-observe
pnpm dsh --profile web-observe-demo
```

Open any Session → switch to the **Observe** tab.

## Layout

| Path | Role |
|---|---|
| `src/index.ts` | Host `ctx.agentObserve.snapshot()` |
| `src/topology.ts` | Live Host topology fold |
| `src/client/index.ts` | Registers `conversation.view` id `observe` + composer shortcut |
| `src/client/ViewShortcut.tsx` | Turn-tail icon that opens the Observe tab |
| `src/client/ObserveView.tsx` | Toolbar + AITopo fleet / flow panes |
| `src/client/aitopo/` | `AITopoHost` + snapshot/flow → `GraphDocument` adapters |
| `src/client/derive-topology.ts` | Client list → fleet snapshot |
| `src/client/derive-flow.ts` | Session events → process topology |
| `src/client/layout.ts` / `layout-flow.ts` | Fleet / flow coordinates for the document |

## Notes

- Client status is approximate: `running` and workspace **archived** are exact; non-archived cold Sessions still appear as **idle** until a Host Remote exposes Agent attachment.
- Agent Teams grouping needs membership (`teamId`); without it the tab shows the unavailable hint. With `teamId`, double-click enters a SubNetwork.
- Graph rendering uses `@neuravoxel/aitopo` (vendored under `vendor/aitopo`).

## Model Experience

No model-visible text or tools. Host topology is for operators / UI only.

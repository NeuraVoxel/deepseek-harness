# agent-canvas

Opt-in plugin: a **Canvas** tab beside Chat / Trajectory that shows Session / Agent topology.

- Nodes: every listed Session (Client list) with `running` / `idle` status
- Edges: subagent `parentId` links
- Groups: **Workspace** (default), **Parent tree**, **Agent Teams** (placeholder until Teams is composed + wired)
- Click a node → `sessions.open(id)`
- **Double-click** a node → process Canvas for that Agent’s **latest turn** (Client input → Host admit → Step → Model → Tools → Turn end → Client render), with **active** nodes highlighted while the Session is running

Does **not** modify `packages/` — mounts via patch / `dsh plugin`.

## Run

```sh
pnpm install
pnpm --filter dsh-agent-canvas bundle
pnpm dsh web --patch ./plugins/agent-canvas/cordis.patch.yml
```

Or install into a profile:

```sh
pnpm --filter dsh-agent-canvas bundle
pnpm dsh plugin --profile web-canvas-demo add ./plugins/agent-canvas
pnpm dsh --profile web-canvas-demo
```

Open any Session → switch to the **Canvas** tab.

## Layout

| Path | Role |
|---|---|
| `src/index.ts` | Host `ctx.agentCanvas.snapshot()` |
| `src/topology.ts` | Live Host topology fold |
| `src/client/index.ts` | Registers `conversation.view` id `canvas` |
| `src/client/CanvasView.tsx` | SVG canvas + group toolbar + flow pane |
| `src/client/derive-topology.ts` | Client list → fleet snapshot |
| `src/client/derive-flow.ts` | Session events → process topology |
| `src/client/layout.ts` / `layout-flow.ts` | Fleet / flow layouts (twaver swap-in) |

## Notes

- Client status is approximate: only `running` is exact; cold vs idle live Agents both appear as **idle** until a Host Remote is added.
- Agent Teams grouping needs the experimental Teams remote; the tab still loads and shows the unavailable hint.
- Graph rendering is SVG today; `layout.ts` is the adapter seam for **twaver.js** (bring your own license).

## Model Experience

No model-visible text or tools. Host topology is for operators / UI only.

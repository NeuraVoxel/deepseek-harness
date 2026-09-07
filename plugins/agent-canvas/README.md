# agent-canvas

Opt-in plugin: a **Canvas** tab beside Chat / Trajectory that shows Session / Agent topology.

- Nodes: every listed Session (Client list) with `running` / `idle` status
- Edges: subagent `parentId` links
- Groups: **Workspace** (default), **Parent tree**, **Agent Teams** (SubNetwork when `teamId` exists)
- Click a node → `sessions.open(id)`
- **Double-click** a node → process Canvas for that Agent’s **latest turn** (Client input → Host admit → Step → Model → Tools → Turn end → Client render), with **active** nodes highlighted while the Session is running
- Sibling tools from one assistant message stack in a **parallel column** and rejoin at Join
- Rendering: **[@neuravoxel/aitopo](../../vendor/aitopo)** Canvas Network (dirty-rect); no SVG stage

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
| `src/client/CanvasView.tsx` | Toolbar + AITopo fleet / flow panes |
| `src/client/aitopo/` | `AITopoHost` + snapshot/flow → `GraphDocument` adapters |
| `src/client/derive-topology.ts` | Client list → fleet snapshot |
| `src/client/derive-flow.ts` | Session events → process topology |
| `src/client/layout.ts` / `layout-flow.ts` | Fleet / flow coordinates for the document |

## Notes

- Client status is approximate: only `running` is exact; cold vs idle live Agents both appear as **idle** until a Host Remote is added.
- Agent Teams grouping needs membership (`teamId`); without it the tab shows the unavailable hint. With `teamId`, double-click enters a SubNetwork.
- Graph rendering uses `@neuravoxel/aitopo` (vendored under `vendor/aitopo`).

## Model Experience

No model-visible text or tools. Host topology is for operators / UI only.

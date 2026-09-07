# agent-canvas

可选插件：在 Chat / Trajectory **平级**增加 **Canvas** Tab，展示 Session / Agent 拓扑。

- 节点：列表中的全部 Session，状态 `running` / `idle`
- 边：subagent 的 `parentId`
- 分组：默认 **Workspace**，可切 **父子树** / **Agent Teams**（未挂 Teams 时提示不可用）
- 点击节点 → `sessions.open(id)`

**不修改** `packages/`，通过 patch / `dsh plugin` 挂载。

## 怎么跑

```sh
pnpm install
pnpm --filter dsh-agent-canvas bundle
pnpm dsh web --patch ./plugins/agent-canvas/cordis.patch.yml
```

或装进 profile：

```sh
pnpm --filter dsh-agent-canvas bundle
pnpm dsh plugin --profile web-canvas-demo add ./plugins/agent-canvas
pnpm dsh --profile web-canvas-demo
```

打开任意 Session → 切到 **Canvas** Tab。

## 目录

| 路径 | 作用 |
|---|---|
| `src/index.ts` | Host `ctx.agentCanvas.snapshot()` |
| `src/topology.ts` | Host 侧 live 拓扑 |
| `src/client/index.ts` | 注册 `conversation.view`（id `canvas`） |
| `src/client/CanvasView.tsx` | SVG 画布 + 分组工具条 |
| `src/client/derive-topology.ts` | Client 列表 → snapshot |
| `src/client/layout.ts` | 列布局（可换成 twaver.js） |

## 说明

- Client 状态是近似的：只有 `running` 精确；冷会话与 idle live Agent 都会显示为 **idle**，除非后续加 Host Remote。
- Agent Teams 分组依赖实验性 Teams remote；未挂载时 Tab 仍可用并提示。
- 当前用 SVG 渲染；`layout.ts` 是接入 **twaver.js** 的替换点（需自备授权）。

## 模型体验

无面向模型的文案或工具；Host 拓扑仅供运维 / UI。

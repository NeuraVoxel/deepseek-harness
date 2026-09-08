# agent-canvas

[English](README.md) | 中文

可选插件：在 Chat / Trajectory **平级**增加 **Canvas** Tab，展示 Session / Agent 拓扑。

- 节点：列表中的全部 Session，状态 `running` / `idle`
- 边：subagent 的 `parentId`
- 分组：默认 **Workspace**，可切 **父子树** / **Agent Teams**（有 `teamId` 时用 SubNetwork）
- 单击节点 → `sessions.open(id)`
- **双击**节点 → 打开该 Agent **最近一轮**流程 Canvas：
  `Profile → Session → Envelope → Client 输入 → Host 接纳 → Context → Step → Model → Tools → Turn end → Client 渲染`，**进行中**节点高亮
- **Harness 节点（对齐 Host 实现）：** Profile = boot 组合（Client 读不到 profile 名）；Session = 当前日志身份；Envelope = `request/header` 的 EpochHeader（system + tools + call config）加上 `agentPreset`；Memory = Session surface + compaction（**没有**独立 Memory 服务）；Context = 每步 LLM 请求上下文（`request/header` + 非 user 源的 `user/message` 注入）
- **边：** 灰色 **flow** 步骤线走控制主轴（`admit → Context → Step → …`）；青色 **data** 数据线汇入 Context（`Memory → Context`、`Envelope → Context`）
- 同一条 assistant 里的多个 tool 竖排为**并行列**，再汇入 Join
- 渲染：[@neuravoxel/aitopo](../../vendor/aitopo) Canvas Network（dirty-rect）；无 SVG 舞台

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
| `src/client/CanvasView.tsx` | 工具条 + AITopo 总览 / 流程 |
| `src/client/aitopo/` | `AITopoHost` + snapshot/flow → `GraphDocument` 适配 |
| `src/client/derive-topology.ts` | Client 列表 → 总览 snapshot |
| `src/client/derive-flow.ts` | Session 事件 → 流程拓扑 |
| `src/client/layout.ts` / `layout-flow.ts` | 总览 / 流程坐标（写入 Document） |

## 说明

- Client 状态是近似的：只有 `running` 精确；冷会话与 idle live Agent 都会显示为 **idle**，除非后续加 Host Remote。
- Agent Teams 分组依赖成员 `teamId`；没有时提示不可用。有 `teamId` 时双击进入 SubNetwork。
- 图形渲染使用 `@neuravoxel/aitopo`（源码在 `vendor/aitopo`）。

## 模型体验

无面向模型的文案或工具；Host 拓扑仅供运维 / UI。

# agent-observe

[English](README.md) | 中文

可选插件：在 Chat / Trajectory **平级**增加 **观察** Tab，展示 Session / Agent 拓扑。

- 节点：列表中的全部 Session，状态 `running` / `idle` / `archived`（`cold` 留给 Host 或后续 Remote）
- 边：subagent 的 `parentId`
- 分组：默认 **Workspace**（列从左到右对齐 Harness Workspaces 列表顺序），可切 **父子树** / **Agent Teams**（有 `teamId` 时用 SubNetwork）
- 单击节点 → `sessions.open(id)`
- 在某轮 Turn 的 assistant-actions 行点 **打开观察** → 直接进入该 Turn 的 **流程**模式并**钉住**（更新的 Turn 不会自动抢走画布）
- 总览 **双击** → 打开该 Agent **最新** Turn 的流程 Canvas（`focusTurn = null`）
- Flow 内第二行维度 Tab：**架构**（默认；端到端 + Turn 环 / 能力缝 Group，可展开或 SubNetwork 下钻，含事件珠）· **进程流**（`derive-flow`）· **事件流**（左时间线 / 右 payload）；钉住 Turn 跨维度共享
- 架构图把全景 / 闭环 / 能力缝骨架作为层嵌入（不再单独占 Tab）
- 流程 **双击空白画布** → 返回总览（点中节点/边不返回；事件流双栏不绑该手势）
- 钉住的 Turn 不是 Session 最新时，流程工具栏出现 **跳到最新**；点击清除钉住并留在流程模式
- **限制：** Turn 由快捷入口 `messageId` 对应的持久化 `assistant/message.id` 反查得出（插件内解析）；本轮不扩展 `packages/` 中的 `AssistantActionOwnerProps`
- **Client↔Host 通信节点：** `session.prompt`（一元 Remote）与 `session.follow`（流式 Remote）；Host 本地总线留在 Host admit / Session 内
- **Harness 节点（对齐 Host 实现）：** Profile = boot 组合（Client 读不到 profile 名）；Session = 当前日志身份；Envelope = `request/header` 的 EpochHeader（tools + call config）加上 `agentPreset`（system prompt 是 surface 上的 `system/message`）；Memory = Session surface + compaction（**没有**独立 Memory 服务）；Context = 每步 LLM 请求上下文（`request/header` + 非 user 源的 `user/message` 注入）
- **Turn / Step 只作分区标签**（标题 + `Host · Step N`），不是图节点——Host admit 是 Client→Host 交接；Context 以数据边喂给 Model
- **边：** 灰色 **flow** = 控制 / 收束；青色 **data** = 载荷（`Client input → Host admit`、`Session → Envelope`、`Memory/Envelope → Context`、`Context → Model`、`Model → Tool`、`Model/Tool → Session`、`Session → Client render`）
- 同一条 assistant 里的多个 tool 竖排为**并行列**，再汇入 Join
- 渲染：[@neuravoxel/aitopo](../../vendor/aitopo) Canvas Network（dirty-rect）；无 SVG 舞台
- 骨架图（全景 / 闭环 / 能力缝）为 TypeScript 常量图 + 保守实况高亮（无证据则保持灰态说明），由架构 Tab 复用

**不修改** `packages/`，通过 patch / `dsh plugin` 挂载。

## 怎么跑

```sh
pnpm install
pnpm --filter dsh-agent-observe bundle
pnpm dsh web --patch ./plugins/agent-observe/cordis.patch.yml
```

或装进 profile：

```sh
pnpm --filter dsh-agent-observe bundle
pnpm dsh plugin --profile web-observe-demo add ./plugins/agent-observe
pnpm dsh --profile web-observe-demo
```

打开任意 Session → 切到 **观察** Tab。

## 目录

| 路径 | 作用 |
|---|---|
| `src/index.ts` | Host `ctx.agentObserve.snapshot()` |
| `src/topology.ts` | Host 侧 live 拓扑 |
| `src/client/index.ts` | 注册 `conversation.view`（id `observe`）+ 输入框快捷图标 |
| `src/client/ViewShortcut.tsx` | Turn 尾栏打开观察 Tab 的图标 |
| `src/client/ObserveView.tsx` | 工具条 + 维度 Tab + AITopo / 事件流 |
| `src/client/flow-dimensions/` | 维度注册、骨架图、实况叠加、事件双栏 |
| `src/client/aitopo/` | `AITopoHost` + snapshot/flow → `GraphDocument` 适配 |
| `src/client/derive-topology.ts` | Client 列表 → 总览 snapshot |
| `src/client/derive-flow.ts` | Session 事件 → 流程拓扑 |
| `src/client/layout.ts` / `layout-flow.ts` | 总览 / 流程坐标（写入 Document） |

## 说明

- Client 状态是近似的：`running` 与 workspace **已归档**精确；非归档的冷会话在挂 Host Remote 前仍显示为 **idle**。
- Agent Teams 分组依赖成员 `teamId`；没有时提示不可用。有 `teamId` 时双击进入 SubNetwork。
- 图形渲染使用 `@neuravoxel/aitopo`（源码在 `vendor/aitopo`）。
- 非平凡、仅 observe 的决策使用 `.agents/notes/` 下的 kit Agent Notes（`pnpm run verify-notes`）；见 [AGENTS.md](AGENTS.md)。

## 模型体验

无面向模型的文案或工具；Host 拓扑仅供运维 / UI。

# Agent Note: agent-canvas harness 框架节点（Profile / Session / Envelope / Memory / Context）

Status: implemented

[English](2026-09-08-agent-canvas-harness-flow-nodes.md) | 中文

## Problem

agent-canvas 过程视图原先只画 Agent Loop 流水线（`client-input → host-admit → step → model → tool → join → turn-end → client-render`）。运维侧看不到真正决定模型输入的 harness 概念：boot 的 Profile 组合、Session 身份、已记录的请求信封（system + tools + call config + preset）、Session surface 的 Memory（含 compaction），以及每步 LLM Context 组装。

## Decision

仅扩展 `plugins/agent-canvas` 的 flow 推导（不改 `packages/`）：

- Prelude：**Profile**（boot 组合；Client 读不到 Host profile 名）→ **Session**（id / 生命周期）→ **Envelope**（证据来自 `agent-preset/selected` + 最近 `request/header` / `EpochHeader`：tools、system、model）。画布 kind 为 `envelope`，不是虚构的 Resource 层——harness 没有 Resource 服务。
- 每步：**Memory**（Session surface 消息数 + compaction 括号 / compact 摘要；文案标明没有 Memory 服务）→ **Context**（`request/header` + 非 user 源的 `user/message` 注入；compact 摘要归 Memory）→ 原有 Step → Model → Tools。
- 边：Session → Client input；**admit → Context**（控制）；**Memory → Context** 与 **Envelope → Context**（数据汇入）；主轴继续 Context → Step → …
- 边种类：`flow`（步骤/控制，灰色）与 `data`（汇入 Context 的载荷，青色）；AITopo `drawEdge` 读取 `data.stroke` / `strokeHover` / `lineWidth`。
- Client-input 只收 `source.kind === 'user'` 的提示，避免把上下文注入算成用户输入。
- Turn/step 归属用 `turn/start`…`turn/end` 与 `step/start`…`step/end` 的 seq 区间，因为 surface 消息本身不带 `turn` / `step` 字段。
- IO 检查面板支持指针交互（选中、复制、滚动）；指针事件在面板内停止冒泡，避免选文字时拖动画布或清选中。

## Alternatives considered

- **独立 Architecture 视图。** 本次不做：Hybrid 单图让运维继续留在双击打开的当前 turn。
- **虚构 Memory 服务节点。** 拒绝：仓库没有 Memory 包；画布必须写成 Session surface + compaction。
- **把信封节点标成 Resource。** 评审后拒绝：Resource 不是 harness 用语；**Envelope** 对齐 `request/header` / EpochHeader。
- **用 Host Remote 取 Profile 名。** 延后：有用，但不是诚实展示框架所必需。

## Consequences

- Flow layout 的 prelude 带标签为 `Harness → Host`；配色 / 文案 / 图例覆盖五个新 kind（含 `envelope`）。
- 在出现 header 或 preset 事件前 Envelope 为 `pending`；在出现 header 或注入前 Context 为组装中。
- 必验：`pnpm --filter dsh-agent-canvas test`（derive-flow + layout + aitopo adapters）。

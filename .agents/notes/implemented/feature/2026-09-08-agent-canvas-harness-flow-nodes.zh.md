# Agent Note: agent-canvas harness 框架节点（Profile / Session / Envelope / Memory / Context）

Status: implemented

[English](2026-09-08-agent-canvas-harness-flow-nodes.md) | 中文

## Problem

agent-canvas 过程视图原先只画 Agent Loop。运维看不到 harness 概念（Profile / Session / Envelope / Memory / Context）、Client↔Host 线上方法，以及诚实的数据边 vs 控制边。

## Decision

仅扩展 `plugins/agent-canvas` 的 flow 推导（不改 `packages/`）：

- 布局分区：**Client · Web/CLI**（`Input → session.prompt → session.follow → Render`）→ **Host · Frame · Turn N · preset** → **Host · Step N**。
- 通信节点对齐真实 Typert Remote：**`session.prompt`**（Client→Host 一元调用）与 **`session.follow`**（Host→Client 流）。载体是 Connection / Gateway；Host 进程内 `session/event`、`agent/assistant-stream` 不跨进程，由 history.follow 打包装上 follow。
- 边：Input → `session.prompt` → Host admit；Session + Model → `session.follow` → Render；Memory/Envelope → Context → Model；Model/Tool → Session；admit → Context（flow）。
- 没有 `step` / `turn-end` 图节点。画布 “Context” = 组装后的 GenerateOptions。Memory = Session surface + compaction。
- Client 表面启发式：user source 带 `clientTimeZone` → web，否则 cli。

## Alternatives considered

- **虚构 BFF / SessionBinding / inbox 线节点。** 拒绝：不是线上符号；Host 端用 admit + Session 即可。
- **出站路径标成 `session/event`。** 拒绝：那是 Host 本地总线；线上帧是 `session.follow`。
- **独立 Architecture 视图 / Memory 服务 / Resource 节点。** 此前已拒绝；Envelope 仍对齐 `request/header`。

## Consequences

- 图例含 remote-prompt / remote-follow。
- 必验：`pnpm --filter dsh-agent-canvas test`。

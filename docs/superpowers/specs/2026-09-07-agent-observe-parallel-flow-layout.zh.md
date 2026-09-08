# agent-observe 流程上的并行工具列

[English](2026-09-07-agent-observe-parallel-flow-layout.md) | 中文

**状态：** 已批准（2026-09-07）

**范围：** 仅 `plugins/agent-observe` 流程布局（选项 A：同一条 assistant 消息中的 sibling tool call）

## Decision

在一步一带内，从左到右放置流水线列：

`Step → Model → [tools 竖排] → Join（工具 ≥ 2 时）`

仅一个 tool 时保持单列（无 Join）。`derive-flow` 已有 Model→tools→Join 扇出；本变更是布局 + `kind: 'join'`。

**不**反映 exclusive 与 parallel-safe 的实际调度差异。

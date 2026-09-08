# Agent Note: agent-observe 从 Chat 快捷入口打开按 Turn 钉住的流程

Status: implemented

[English](2026-09-08-agent-observe-turn-scoped-flow.md) | 中文

## Problem

观察 Tab 的 Chat 快捷入口只打开 Tab，不会把流程钉到该入口所在 Turn。运维回看历史 Turn 时，Session 前进会抢走画布；总览双击与既有钉住也缺少明确约定。

## Decision

仅改 `plugins/agent-observe`（[按 Turn 钉住流程规格](../../../docs/superpowers/specs/2026-09-08-agent-observe-turn-scoped-flow.md) 的方案 1）：

- 在 Session binding 中扫描 `message.id` 等于快捷入口 `messageId` 的 `assistant/message` 取 Turn；未命中则打开最新流程。
- 导航 store 增加 `focusTurn: number | null`（`null` = 最新）。`showFlow(turn?)` 钉住或清除；`showLatest()` 清除钉住并留在流程；`showFleet()` 清除钉住。
- `deriveAgentFlow` 折叠钉住的 Turn；缺失 Turn 给出空占位且不静默改靶；实时更新不会抢走历史钉住。
- 当 `focusTurn` 已设且不是 Session 最新 Turn 时，流程工具栏显示 **跳到最新**。
- 总览双击始终 `showFlow()`（最新），与先前钉住无关。

[Composer 视图快捷入口](2026-09-08-composer-view-shortcuts.zh.md) 挂载点不变；观察插件现用 `messageId` 做本次反查。

## Alternatives considered

- **扩展 `AssistantActionOwnerProps` 增加 `turn`** — 本轮拒绝：Chat Turn 尾栏已有 Turn 号，但会改 `packages/client/ui-chat`，违反仅插件范围。
- **钉住的 Turn 缺失时静默改到最新** — 拒绝：掩盖缺失指称；空占位更响亮且保持钉住诚实。
- **上一/下一 Turn 或 Turn 选择器** — 不在范围；跳出历史钉住只用跳到最新。

## Consequences

- 不改 `packages/`；Turn 身份依赖持久化 `assistant/message.id` 与快捷入口 `messageId` 匹配。
- 钉住的历史 Turn 在 Session 实时前进时保持折叠，直到运维跳到最新、返回总览，或双击某个 Agent。
- 必验：`pnpm --filter dsh-agent-observe test`（derive-flow 钉住/缺失/最新、`resolveTurnFromMessageId` 命中/未命中、nav-store 的 `showFlow` / `showLatest` / 总览清除）。

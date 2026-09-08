# agent-observe：从 Chat 快捷入口打开按 Turn 钉住的流程

[English](2026-09-08-agent-observe-turn-scoped-flow.md) | 中文

**状态：** 已批准（2026-09-08）

**范围：** 仅 `plugins/agent-observe`（选项 1：用 `messageId` 反查 Turn，不扩展 `AssistantActionOwnerProps`）

## Product

- 在已定稿 Turn 的 assistant-actions 行点击 **打开观察** → 直接进入 Observe Tab 的 **flow** 模式，展示 **该** Turn，并 **钉住**。
- 钉住期间，更新的 Turn **不会**自动抢走画布。
- 当钉住的不是 Session 最新 Turn 时，流程工具栏显示 **跳到最新**；点击清除钉住（`focusTurn = null`）并留在 flow。
- 舰队 **双击** 始终打开 **最新** Turn 的 flow（`focusTurn = null`），与先前钉住无关。

## Navigation store

扩展 Observe 的 `nav-store`：

| 字段 | 含义 |
|---|---|
| `mode: 'fleet' \| 'flow'` | 现有 |
| `focusTurn: number \| null` | `null` = 展示最新；数字 = 钉住的 Turn |

Actions：

- `showFlow(turn?: number)` — 进入 flow；传入数字则钉住；省略则 `focusTurn = null`（最新）。
- `showLatest()` — `focusTurn = null`，留在 flow。
- `showFleet()` — 回舰队并清除钉住（避免下次误用旧钉）。

## Open Observe path

`ViewShortcut` 今日只收到 `messageId` 并点击观察 Tab。改为 inject 回调 `openObserveFlow(messageId)`，闭包持有 Session binding + nav-store：

1. 扫描 binding 的 event window，找 `assistant/message` 且 `message.id === messageId`，取 `data.turn`。
2. 未命中 → `showFlow()`（最新）；仍打开 Tab（不在 UI 外静默失败）。
3. 命中 → `showFlow(turn)`。
4. `openConversationViewTab(本地化「观察」标签)`。

无耐久 `messageId` 的中断 Turn 尾栏本就不渲染 assistant-actions；无新增边界。

## Flow derivation

`deriveAgentFlow(window, session, focusTurn?: number | null)`：

- `focusTurn == null` → 与今天相同（`findLatestTurn`）。
- 有数字 → 折叠 `eventsInTurn(durable, focusTurn)`。
- 若该 Turn 不在日志中 → Turn N 的空态 / 不可用占位；**不要**静默把 `focusTurn` 改到最新。
- 已 `turn/end` 的钉住历史轮按该轮结算节点状态，即使 Session 正在跑更新的轮。

`createAgentFlowSource` 在 events、session 生命周期 **或** `focusTurn` 变化时重投影，使钉住在 live 更新下仍保持。

## Flow toolbar

- 保留 `flow.title`（`Turn {turn}`）。
- 当 `focusTurn !== null` 且 `focusTurn !== latestTurn` 时，显示 **跳到最新** → `actions.showLatest()`。
- 已在最新（`focusTurn === null` 或等于最新）时隐藏该控件。

不在范围：Turn prev/next、Turn 选择器、AITopo 引擎改动、Host topology Remote、舰队布局改动。

## Why plugin-only `messageId` → Turn

Chat 的 Turn 尾栏已知 Turn 号，但给 `AssistantActionOwnerProps` 增加 `turn` 会改动 `packages/client/ui-chat`。本变更留在可选插件内，从拥有快捷入口 `messageId` 的耐久 `assistant/message` 反查 Turn。已知限制：身份依赖该 id 匹配；写入插件 README。

## Tests

插件 vitest（本可选插件不强制 GUI e2e）：

- `derive-flow`：钉住历史轮；缺失 Turn 占位；`null` = 最新；窗口出现更新轮时钉住仍保持。
- `messageId` → Turn 辅助：命中与未命中→最新。
- `nav-store`：`showFlow(n)` / `showLatest` / 双击路径的 `showFlow()`。

## Docs

- 更新 `plugins/agent-observe/README.md` + `.zh.md`：快捷入口打开钉住 Turn 的 flow；双击 = 最新；跳到最新；`messageId` 反查限制。
- 同 PR Agent Note：本切口为何用插件反查而非扩展 owner props。

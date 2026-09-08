# Agent Note: 观察 / 编排 Tab 的 Composer 快捷入口

Status: implemented

[English](2026-09-08-composer-view-shortcuts.md) | 中文

## Problem

可选的观察、编排对话 Tab 在 Session 顶栏 Tab 环被滚出或收进 chrome 时不易发现。运维希望从 Chat 转录区一键跳转，且不改 harness 包；后续还需要能承载按 Turn 灌数的挂载点。

## Decision

各插件在 `conversation.chat.assistant-actions`（Turn 尾栏、与 Turn usage / turn-cost 同行）注册自己的紧凑控件，样式为 28px 圆形图标：

- `dsh-agent-observe` → id `agent-observe`，order `30`，打开 view id `observe`
- `dsh-agent-orchestrator` → id `agent-orchestrator`，order `40`，打开 view id `orchestrator`

Owner 的 `messageId` 已接入但暂不使用，以便后续按 Turn 灌数时不必挪挂载点。点击后按本地化的 Tab 文案匹配 Session 顶栏 `[role=tab]` 并触发 click，复用外壳已有的 `selectView` 路径。插件不写 Conversation View store：该 handle 为 `ui-conversation` 私有，且功能插件不得 runtime 导入另一功能包的值。

## Alternatives considered

- **挂在 `conversation.input.dock`（输入框上方）** — 拒绝：产品要求落在每轮 Turn 下方，便于后续灌数。
- **挂在 `conversation.input.right`（紧挨 ContextMeter）** — 拒绝：同样缺乏按 Turn 的座位。
- **在 action props 上暴露 harness `selectView` API** — 延后；这是更稳的缝，但需要请求所禁止的 `packages/` 改动。

## Consequences

- 不改 `packages/`；仅在对应插件被 patch / 安装且 Turn 有可持久化的收尾 `messageId` 时出现快捷入口。
- 切 Tab 依赖顶栏 tablist 仍在文档中；文案须与各 view 条目的 `label` thunk 保持一致。
- 验证：`pnpm --filter dsh-agent-observe test`，`pnpm --filter dsh-agent-orchestrator test`。

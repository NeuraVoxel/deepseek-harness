# deepseek-harness 如何组织上下文？

首次撰写：2026-09-10

> 学习笔记，非正式权威。权威入口：`docs/architecture.md`（Turn flow / Session log）、`docs/subsystems/system-prompt.md`、`packages/context/README.md`、相关 Agent Note。

## 一句话

**Session 日志（surface）是模型所见上下文的唯一源；`system-prompt` 每步组装系统段 + 运行时快照 + 工具 schema；`agent-loop` 把组装结果提交进日志再 `deriveMessages()` 发请求；`packages/context/*` 等插件通过 `inject` / `pre-step` / `systemPrompt.*` 贡献额外内容；压力大时 `compaction` 用 summary 替换旧 surface，而不改写日志真相。**

## 「Context」不是一个类型

写代码或读文档时，先分清同名不同物：

| 说法 | 实际含义 | 典型入口 |
|---|---|---|
| Request-context 插件 | `packages/context/`：给请求加**模型可见、可持久化**上下文，**不定义工具** | `agent-instructions`、`time-context` 等 |
| System prompt / `PromptSection` | 每步组装的系统提示段 → surface 上的 `system/message` | `ctx.systemPrompt.section()` |
| Runtime context / `PromptContext` | 与 section 分开注册的动态事实 → loop 合成**一条带 source 的 user 快照** | `ctx.systemPrompt.context()` |
| `AssembleContext` | 一次 `assemble()` 的作用域 / signal（可带 live `agent`） | system-prompt 子系统页 |
| `request/context` 事件 | **log-only** 路由元数据（provider、model、`contextWindow`…），**不是**模型正文 | `SessionEventMap` |
| Session log / surface / `deriveMessages()` | 模型历史的权威源；surface 投影为 `Message[]` | `ctx.sessions` |
| `agent.inject()` | 补充模型可见输入的调用方 API；进 next-step inbox，不单独开 turn | architecture 扩展表 |
| Compaction | 压力下用一条 summary `user/message` **替换**较旧 surface | `ctx.compaction` |
| Session projection | 给**客户端** fold 的状态（todos、占用率…），**不是**发给模型的上下文 | `ctx.sessionProjections` |
| `ContextForm` | 注入上下文的信息形状（instructions / catalog / snapshot / …），供 UI | Agent Note `2026-08-05-context-form-vocabulary` |

易混三点：

1. **`packages/context/` ≠ `request/context` 事件** —— 前者是插件族；后者是路由容量元数据。
2. **`PromptContext` ≠ request-context 插件** —— 前者走 `systemPrompt.context()` + loop 的 runtime 投影；后者多通过 `agent/pre-step` / `inject()` 写成独立 `user/message`。
3. **Session projection ≠ `deriveMessages()`** —— 一个服务 UI；一个服务模型请求历史。

## 包怎么拆

### `packages/context/` — Request-context 插件组

| 包 | 作用 | 默认 |
|---|---|---|
| `agent-instructions` | 加载 AGENTS.md / CLAUDE.md 链 | `dsh-base` 默认开 |
| `session-reference` | 其它 session 的有界只读快照 | opt-in |
| `file-reference` (+ local) | `@file` mention 发现 / 补全（不读文件内容） | 视 profile |
| `time-context` | 当前时间 / zone / elapsed | opt-in |
| `tmux-context` | tmux session/window/pane | opt-in |

共性：注入物进入 session 历史，作为 **user-role** 消息持久化，可 replay，可被 compaction。

### `packages/core/` — 组装与循环

| 包 | 职责 | ctx |
|---|---|---|
| `session` | 追加日志、`deriveMessages()`、surface、`request/header` / `request/context` fold | `ctx.sessions` |
| `system-prompt` | section / context / tools / variable 注册与 `assemble()` | `ctx.systemPrompt` |
| `agent-loop` | turn/step；SystemPrompt 与 RuntimeContext 投影；`inject()` | `ctx.agentLoop` |
| `agent` / `tools` | Agent 接口；工具 schema 进入 assembly | `ctx.agents` / `ctx.tools` |

### `packages/compaction/` — 压缩能力族

Service Definition（`compaction`）+ Provider（`compaction-basic`）+ Consumer（`command-compact`）+ tool-result pruner。度量用 `ctx.tokenMeter`（在 LLM 族），不在 compaction 组内。

### `packages/session/` — 持久化与投影（旁路）

日志落盘、客户端 projection、标题、telemetry。与「模型上下文」相关但**不**替代 `deriveMessages()`。

## 每步如何变成一次模型请求

权威顺序见 `docs/architecture.md`「Turn flow」。浓缩：

```text
claim inbox（next-step 注入 + 必要时 queued prompt）
  → systemPrompt.assemble()          // sections + PromptContexts + tool schemas + variables
  → RuntimeContextProjection         // 有变化则生成 sourced user 快照候选
  → agent/pre-step waterfall         // 可 rewrite / reject；compaction-basic 可在此压历史
  → SystemPromptProjection           // append / replace system/message
  → step/start
  → 提交 system/message（必要时）+ 进入的 user/message
  → agent/request → prepareCall()    // 真实路由能力决定 prompt 准入（不是旧 request/context）
  → 按需 append request/header、request/context
  → session.deriveMessages() → 冻结 → llm/stream
  → tool/call* … tool/result*
  → step/end →（压力）compactIfNeeded / 下一 step
```

### Surface → 模型消息

| Surface 事件 | 模型角色 |
|---|---|
| `system/message` | `system`（空 content → 不投影为 wire 消息） |
| `user/message` | `user`（人工输入、inject、runtime 快照、compaction summary…） |
| `assistant/message` | `assistant` |
| `tool/result` | user-role tool result |

`assistant/attempt`、`request/header`、`request/context`、`compaction/start|summary|end` 等是 **log-only**，不进 `deriveMessages()`。

### System 段 vs Runtime 快照

- **Sections** → `renderPrompt()` → `system/message`（通常 node 0；`systemPromptUpdate: 'in-history'` 时可在系列内 append）。
- **PromptContexts** → 合成一条 user 消息（「Current runtime context…」类前缀），由 loop 追加；清空有固定 cleared 文案。
- Tool schemas 在 assembly 里，经 `request/header` 记录；wire 上常是独立字段，语义上同属一次 assembly。

### Compaction 对上下文的影响

1. `compaction/start` →（可选）summarize → `compaction/summary` → **唯一 surface 变更**：`user/message` + `surfaceOp: replace` 阴影旧节点 → `compaction/end`。
2. 之后 `deriveMessages()` 只见 summary + 保留尾部；被阴影事件仍在 raw log，保证 replay。
3. System head（node 0）一般**不在**可压缩范围内。

## 想加上下文：选哪条扩展点

| 目标 | 机制 | 例子 |
|---|---|---|
| 固定 / 半固定系统说明 | `ctx.systemPrompt.section()` + `getSectionOrder()` | tool 指引、persona |
| 每步变化、可 supersede 的策略快照 | `ctx.systemPrompt.context()` + `getContextOrder()` | sandbox / approval / subagent 委派说明 |
| 模板变量 `{{cwd}}` 等 | `ctx.systemPrompt.variable()` | loop 提供 model / cwd |
| 工具 schema | 注册 `ctx.tools`（自动进 assembly） | 几乎所有 tool 包 |
| 改整次 assembly | `system-prompt/assemble` waterfall（须 `next()`） | expert 改写 |
| 本步最终进入的消息批 | `agent/pre-step` → `PreStepDecision.messages` | `agent-instructions`、`time-context` |
| 不唤醒；下一可用边界再进请求 | `agent.inject(UserMessage)` | job 完成通知、session 引用准备后注入 |
| 工具后附加 | tools 的 `additionalContexts` → next-step inbox | 工具管线 |
| 压缩策略 | 实现 `CompactionEngine` / 挂 `compaction-basic` | `/compact`、pressure |
| 新「模型可见事实」类型 | 扩展 `SessionEventMap` + 从 log 渲染 | 新事件 |

**不要**为塞上下文去改 `agent-loop`。architecture「Where new behavior goes」写明：*Add model-facing context → `agent.inject()`*；*Plugins, not loop changes*。

通过 `agent.ctx` 注册的 section / context / variable **覆盖**同名全局，且不污染其它 agent。

## 设计原则（钉住心智模型）

1. **Model-visible ⟺ logged** — 进入模型请求的内容必须能从 session log 重建；新模型可见输入 ⇒ 新 `SessionEventMap` 成员 + 从 log 渲染。
2. **Plugins, not loop changes** — 挂文档化扩展点；改 loop 必须同步 `docs/architecture.md`。
3. **Surface 是派生历史的唯一来源** — `deriveMessages()` 只走 surface；系统提示是 `system/message`，不是 `request/header.system`。
4. **注入与执行分离** — `inject()` 只往 inbox 放非唤醒上下文；turn = 跑模型循环。Idle 注入不开合成 turn。
5. **三条贡献通道勿混用** — Sections → system；PromptContexts → superseding runtime user 快照；context 组插件 → 独立 sourced `user/message`。
6. **`request/context` 不决定 prompt 准入** — 准入看本次 `prepareCall()`；事件只记录实际路由元数据。
7. **Compaction 是可选 capability seam** — 不是 loop spine；摘要仍是普通 `user/message`。
8. **Waterfall 必须 `next()`** — `agent/pre-step`、`system-prompt/assemble`、`agent/request`、`tools/*` 等。
9. **面向模型的文案从模型视角写** — 不含 UI / 传输 / 实现词汇。

## 权威阅读顺序

1. `docs/architecture.md` — Turn flow、Session log、扩展表
2. `docs/subsystems/system-prompt.md` + `packages/core/system-prompt/README.md`
3. `packages/context/README.md` + 关心的子包 README
4. `docs/subsystems/compaction.md`（需要压缩时）
5. Agent Note（按需）：
   - `2026-09-02-system-prompt-as-surface-node`
   - `2026-07-05-reconstructable-requests`
   - `2026-07-24-separate-context-injection-from-turn-execution`
   - `2026-07-08-agent-scope-contexts`
   - `2026-08-05-context-form-vocabulary`
   - `2026-06-18-compaction-capability-seam`
   - `2026-07-29-projected-token-usage-and-request-context`

## 改动时的自检清单

- [ ] 新内容模型可见吗？若是 → 是否写入 / 可从 session log 重建？
- [ ] 该走 section、runtime context、inject、还是 pre-step？通道是否选对？
- [ ] 是否误把 Session projection / `request/context` 当成模型正文？
- [ ] 是否在改 loop 而不是挂扩展点？
- [ ] Waterfall 是否调用了 `next()`？
- [ ] Agent 级注册是否应走 `agent.ctx` 以免泄漏到其它 agent？

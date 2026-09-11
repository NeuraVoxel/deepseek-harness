# deepseek-harness 数据流架构（全景 + 闭环）

首次撰写：2026-09-11

> 学习笔记，非正式权威。权威入口：`docs/architecture.md`（Turn flow / Session log / 扩展表）、`docs/agent-lifecycle.md`、`docs/tool-execution-pipeline.md`、`docs/capability-seams.md`。上下文从哪来见 sibling 笔记 `2026-09-10-how-context-is-organized.md`。

## 一句话

**入口经 `dsh --profile` 组成 Cordis 树；工作以 Session 日志为唯一真相；`agent-loop` 按 turn/step 组装提示、冻结请求、流式调用模型、跑工具；工具背后走 capability seam（换 Provider 不换工具名）；`sessionProjections` / SDK / Web 从日志派生 UI，不替代 `deriveMessages()`。**

## 先分清三条「流」

| 流 | 问题 | 本笔记 |
|---|---|---|
| **产品路径（A）** | 谁启动、结果谁看见 | 主写 · 图 1 |
| **运行时闭环（B）** | 一步模型请求怎么走完 | 主写 · 图 2 |
| **能力缝（C）** | 工具背后谁真正执行 | 穿插 · 图 2 的 `tools/*` 处 |

易混：

1. **Session projection ≠ 模型历史** — 前者 fold 给客户端；后者只靠 `deriveMessages()`。
2. **活体 `agent/*` 事件 ≠ 耐久 Session 事件** — 前者拦在途中的工作；后者写入日志并可重建。
3. **`packages/context/*` ≠ 本篇主题** — 那是「塞什么进上下文」；本篇是「数据怎么在系统里走」。

---

## 图 1：端到端全景（A）

```text
  Web / headless / SDK / ACP / webhook / Desktop
                 │
                 ▼
        dsh --profile <name>
      bundles + cordis.patch.yml
                 │
                 ▼
           Cordis 插件树
   ┌─────────────┼─────────────┐
   │             │             │
   ▼             ▼             ▼
ctx.sessions  ctx.agents    ctx.llm / tools /
              + agentLoop   systemPrompt / …
                 │
                 │  create / open Agent
                 ▼
            一次（多次）Turn
                 │
        ┌────────┴────────┐
        ▼                 ▼
  Session 日志        活体扩展点
  (耐久事实)         agent/* · tools/*
        │
        ├─► sessionPersistence（落盘 JSONL 等）
        ├─► sessionProjections → Web / Host UI
        └─► SDK / ACP 投影同一条日志
```

读图要点：

- **唯一应用启动面是 `dsh` + profile**（`web` / `headless` / `sdk` / `sdk-minimal` / `acp`；Desktop 走保留 profile）。包 bin、demo、绕过 profile 的 argv 不是支持的应用入口。
- **`dsh-base` 是多数 profile 的第一层**（模型、工具、持久化、沙箱与审批、设置、凭证、telemetry）；`web-app` / `headless` / `sdk-app` / `acp-app` 再叠应用面。`sdk-minimal` 故意不叠 base，自带完整显式树。
- **Webhook** 经 `ctx.webhookRuntime` 把可信投递变成普通 Workspace Session，之后与其它入口共用同一套 loop。
- **旁路只读日志**：UI / SDK 跟的是 `session/event` 与 projection，不是另开一套「模型记忆」。

---

## 图 2：Turn / Step 闭环（B）

一步（step）= 一次模型请求 + 它发起的工具调用。一轮（turn）= 零或多步：在认领首个输入前打开，在不再欠请求时关闭。

```text
turn/start
  │
  ├─ claim inbox：next-step 注入 +（必要时）排队用户消息
  ├─ systemPrompt.assemble()     // sections + runtime contexts + tool schemas
  ├─ agent/pre-step  waterfall   // rewrite / reject；可空关 turn
  │     reject 或首批 enter 被改空 → 无 step 直接关 turn
  │
  ├─ step/start
  ├─ agent/request → prepareCall()   // 真实路由；取消则不提交 system/users
  ├─ 提交 system/message（必要时）+ 进入的 user/message
  ├─ 按需 append request/header、request/context（log-only 元数据）
  ├─ deriveMessages() → 冻结 Message[] → llm/stream
  │     agent/assistant-stream start / chunk* / end
  │     落盘：assistant/message 或 assistant/attempt
  │
  ├─ tool/call* ──► 【能力缝插曲 · 见下】──► tool/result*
  ├─ step/end
  │     还欠下一步 / 又有 next-step 输入 → 再 claim → 下一 step
  │
  └─ agent/turn-stopping（serial，无 next()）
turn/end
```

耐久 Session 事件（进日志）：`turn/*`、`step/*`、`system/message`、`user/message`、`assistant/message`、`assistant/attempt`、`tool/*`、以及按需的 `request/header` / `request/context`。

活体扩展点（多数不进模型历史）：`agent/pre-step`、`agent/request`、`llm/stream`、`agent/assistant-stream`、`tools/pre-execute|execute|post-execute`、`agent/turn-stopping`。

硬规则：

- **Model-visible ⟺ logged** — 进模型请求的内容必须能从日志重建；新模型可见输入 ⇒ 新 `SessionEventMap` 成员。
- **Waterfall 必须 `next()`** — `agent/pre-step`、`agent/request`、`llm/stream`、`tools/*`；漏掉会短路整条链。
- **`agent/turn-stopping` 无 `next()`** — serial 钩子，用来在关 turn 前做最后动作。
- **取消窗口**：`prepareCall` / `agent/request` 期间取消 → 不提交本步 system/users。
- **重试**：不重跑 assemble / `agent/pre-step`；同一系列内复用已提交头。

时序细图见 `docs/agent-lifecycle.md`；工具管线见 `docs/tool-execution-pipeline.md`。

---

## 插曲：能力缝（C）— 嵌在 `tools/*`

模型侧只看见稳定的工具名与 `tool/call` / `tool/result`。真正干活的是缝上的 Provider：

```text
  tool/call
      │
      ▼
  tools/pre-execute → tools/execute → tools/post-execute
      │
      ▼
  Consumer（常是 tool-* 包）
      │  调 Service Definition 接口
      ▼
  ctx.fs / ctx.shell / ctx.subprocess / ctx.web / ctx.subagents / …
      │
      ▼
  Provider（local / sandbox / e2b / 远程子代理 …）
      │
      ▼
  tool/result → 写回 Session 日志 → 可进下一轮 deriveMessages()
```

三角角色（缺一不成缝）：

| 角色 | 职责 | 例子 |
|---|---|---|
| **Service Definition** | 声明 `ctx.*` 接口 | `ctx.fs`、`ctx.shell` |
| **Service Provider** | 实现执行世界 | `fs-local`、`bash-sandbox`、`web-fetch-http` |
| **Consumer** | 模型或其它调用方 | `tool-fs`、`tool-bash`、`tool-web` |

常见缝（只记心智，完整图看 `docs/capability-seams.md`）：

| `ctx` | Consumer 侧直觉 | 换 Provider 时发生什么 |
|---|---|---|
| `ctx.fs` | 读/写/编辑文件工具 | 本地 ↔ sandbox ↔ E2B，工具名不变 |
| `ctx.shell`（背后常经 `ctx.subprocess`） | bash / pwsh | 执行器与进程树世界一起换 |
| `ctx.web` | search / fetch | 搜索与抓取 Provider 注册进同一缝 |
| `ctx.subagents` | 委派子代理 | 进程内 spawn/fork、ACP、Codex、Claude Code、dsh-sdk… |

设计意图一句话：**文件系统与 subprocess 共享一个执行世界** — 指向远程 sandbox 时，Bash、PTY、LSP 跟着走，不必为每个 Consumer 再 fork 一套 Provider。

本笔记不展开每个 Provider；加能力时三角角色要齐，见 architecture「Capability seams」与 cookbook。

---

## 事件分层（帮助读图）

| 域 | 生命周期 | 典型用途 |
|---|---|---|
| **Session 事件** | 追加日志 + `session/event` 广播 | 必须在 reload 后仍在的事实 |
| **`agent/*`** | 绑定活体 `Agent` | 观察 / 拦截 inbox、step、流、关 turn |
| **能力事件**（`tools/*`、`fs/*`…） | 挂在缝上 | 策略与适配，不 import loop |

`assistant/message` 内嵌产生它的 compact timed stream；失败/取消/可重试尝试走 `assistant/attempt`（log-only，不进模型历史）。硬进程丢失若发生在 settlement 前，没有耐久 attempt 流可跟。

---

## 和已有学习笔记的分工

| 笔记 | 管什么 |
|---|---|
| `2026-09-10-how-context-is-organized.md` | 上下文从哪贡献、如何进 surface、compaction 阴影 |
| **本篇** | 入口 → Cordis → turn/step → LLM/工具 → 日志/投影；工具处点到能力缝 |

两篇都钉同一原则：**Plugins, not loop changes** — 新行为挂文档化扩展点；改 `agent-loop` 必须同步 `docs/architecture.md`。

---

## 延伸阅读

1. `docs/architecture.md` — 总图、Turn flow、Session log、扩展表
2. `docs/agent-lifecycle.md` — 序列图
3. `docs/tool-execution-pipeline.md` — `tools/*` waterfall
4. `docs/capability-seams.md` — 生成缝图与服务表
5. `docs/subsystems/core.md` / `session.md` / `llm-streaming.md` — 类型与语义
6. Sibling：`2026-09-10-how-context-is-organized.md`
7. 关键 Agent Note（按需）：`2026-07-05-reconstructable-requests`、`2026-09-01-v2-embedded-assistant-streams`、`2026-08-19-session-projection-mandatory-seam`

## 读完自检

- [ ] 能指出一次用户消息从哪个入口进、最终落在哪类 Session 事件里吗？
- [ ] 能口述 step 内 assemble → pre-step → prepareCall → deriveMessages → stream → tools 的顺序吗？
- [ ] 知道 UI 读的是 projection / `session/event`，而模型读的是 `deriveMessages()` 吗？
- [ ] 看到 `tool/call` 时，能说出「Consumer → `ctx.*` → Provider」这一跳吗？
- [ ] 新模型可见输入会不会漏写 Session 事件？

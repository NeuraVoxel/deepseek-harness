# 团队的上下文工程：如何管理与设计

首次撰写：2026-09-10

> 学习笔记，非正式权威。前置阅读：[如何组织上下文](2026-09-10-how-context-is-organized.md)。权威入口：`docs/architecture.md`、`docs/cookbook/extension-cookbook.md`、`docs/subsystems/agent-team.md`、相关 Agent Note。

## 一句话

仓库**没有**名为 “context engineering” 的专章；实质是两套正交设计：

1. **工程侧**：用「事实单一归属 + 分通道贡献 + Session log 可重建 + 插件挂扩展点」管理所有面向模型的上下文。
2. **产品侧（Agent Teams）**：用「独立 Session + fresh/fork 种子」隔离对话，用「Lead 日志上的 mailbox / task」共享协调态——协调事件本身不进模型历史。

## 先分清「团队」指哪一层

| 层 | 「团队」指谁 | 管什么 |
|---|---|---|
| **B — 工程实践** | 本仓库的贡献者 / agent 维护者 | 谁拥有哪段 prompt、走哪条扩展点、文档分层 |
| **A — 产品** | Agent Teams 里的 Lead / teammate | 多 agent 对话隔离、peer 消息、共享看板 |

下文先讲 **B（怎么管理与设计）**，再讲 **A（产品里团队上下文怎么长）**。

---

## B. 工程侧：上下文工程怎么管

### 心智模型

Session **surface** = 模型所见上下文的唯一源 → `systemPrompt.assemble()` → loop 写入日志 → `deriveMessages()` 发请求。
任何「给模型看」的新增内容，必须能回答：**谁拥有、走哪条通道、如何从 log 重建、UI 用什么 form。**

### 管理手段（四条）

#### 1. 事实单一归属（ownership）

| 事实 | 所有者 |
|---|---|
| Harness 身份 | `harness:identity` section |
| 部署角色 | `deployment:persona-prefix` / `suffix`（子 agent 可 shadow） |
| 单工具语义 | 工具 `description` |
| 跨调用习惯 | **该工具包**的 `systemPrompt.section()` |
| `{{model}}` / `{{cwd}}` | loop 注册 variable；persona 只引用 |
| Section / Context 顺序 | 一等贡献：`getSectionOrder` / `getContextOrder`；外部可用任意有限 order |
| 工作区 AGENTS.md 链 | `agent-instructions` → 持久 sourced `user/message` |

原则：**prompt 里每个事实恰好一个 owner**（Agent Note：`2026-07-05-prompt-variables-and-tool-guidance-ownership`）。禁止两个插件写同一条指引。

#### 2. 分通道，禁止「随便塞」

| 通道 | 产物 | 何时用 |
|---|---|---|
| `section()` | `system/message` | 固定 / 半固定系统说明 |
| `context()` | 可 supersede 的 runtime **user** 快照 | 每步变化的策略（sandbox、approval…） |
| `inject()` / `pre-step` / context 组插件 | 独立 sourced `user/message` | 指令文件、时间、跨 session 引用、peer relay… |
| `ctx.tools` | schema 进 assembly | 能力目录 |
| 新 `SessionEventMap` 成员 | 可投影的新事实类型 | 现有事件表达不了时 |

查表：`docs/architecture.md`「Where new behavior goes」+ `docs/cookbook/extension-cookbook.md`。
**不要**为塞上下文改 `agent-loop`。

#### 3. Model-visible ⟺ logged（可重建）

进入模型请求的内容必须能从 session log 重建；runtime invariant 会断言。
新模型可见输入 ⇒ 扩展 `SessionEventMap` + 从 log 渲染（`2026-07-05-reconstructable-requests`；system 已是 surface node：`2026-09-02-system-prompt-as-surface-node`）。

配套纪律：

- 注入与 turn 分离：`inject()` 不唤醒（`2026-07-24-separate-context-injection-from-turn-execution`）
- Agent 局部用 `agent.ctx`，不泄漏到兄弟 / 父子（`2026-07-08-agent-scope-contexts`）
- Waterfall 必须 `next()`

#### 4. 形状与生产者分离（ContextForm）

`kind` = **谁**生产；`form` = **什么形状的信息**（`2026-08-05-context-form-vocabulary`）：

| form | 含义 | 典型生产者 |
|---|---|---|
| `instructions` | 工作区指令文件 | `agent-instructions` |
| `catalog` | 可更新的条目目录 | skill catalog |
| `snapshot` | 可被后续快照取代的当前态 | runtime context、time/tmux |
| `notice` | 一次性发生说明 | jobs、plan-mode |
| `relay` | 另一 agent 发给本 agent 的消息 | subagent / team message |
| `recall` | 从另一 session 提起的材料 | `session-reference` |

UI 按 form 呈现；视觉细节不进 union。生产者声明 form，读者 all-or-nothing。

### 文档分层（权威谁说了算）

| 载体 | 职责 | 是否权威 |
|---|---|---|
| 根 `AGENTS.md` | 站立订单（一句话 + 链） | 是（规则入口） |
| `architecture.md` / 子系统页 / 包 README | 当前行为与 Known Limitations | 是 |
| Agent Notes `implemented/` | why / 替代方案 / 验证 | 是（决策） |
| `.agents/learning/*` | 学习笔记 | **否** |
| Archived notes | 冻结历史 | **否**（不可当现行规范） |

「上下文工程」的日常管理 = **改代码时改对所有者文档 + 必要时新/更新 Agent Note**，而不是另起一套 prompt 文档库。

### 工程侧自检

- [ ] 新事实的唯一 owner 是谁？会不会和现有 section 重复？
- [ ] 通道选对了吗（system / runtime snapshot / durable user）？
- [ ] 模型可见吗？若是 → Session 事件与投影路径齐了吗？
- [ ] 需要 `ContextForm` 吗？form 与 kind 是否分开？
- [ ] 是否误改 loop，或 waterfall 漏了 `next()`？
- [ ] 是否应走 `agent.ctx` 以免污染其它 agent？

---

## A. 产品侧：Agent Teams 的上下文怎么设计

实验性；决策见 `2026-08-05-agent-teams`；类型见 `docs/subsystems/agent-team.md`。

### 核心拆分：对话史 vs 协调态

| 维度 | 设计 |
|---|---|
| 对话历史 | **每个成员独立 Session**；模型历史互不混写 |
| 协调态权威 | **Lead Session 日志**；`foldTeam()` 派生 roster / mailbox / task |
| Team 事件 | `team/member`、`team/task`、`team/message/queued\|delivered` 为 **log-only**，**不进** `deriveMessages()` |
| 种子 | `context: 'fresh' \| 'fork'`：fresh = 无 Lead 历史；fork = 一次性捕获 Lead **已完成 turn 前缀** |
| Peer 消息 | Lead mailbox → 投递到 target 的 **user-role**（带 `TeamMessageSource`；UI 侧属 relay 类） |
| 策略文案 | 成员 `agent.ctx` 上的 `team:policy` section（同一套九工具，按角色写策略） |
| 工作区 | 同 cwd、同进程；无跨进程 Team / worktree |

含义：**团队上下文工程 ≠ 把所有人的 transcript 拼进一个窗口**；而是「隔离模型可见历史 + 共享 durable 协调面 + 需要时显式投递 user 消息」。

### 与通用 Subagent 的关系

Teams 建在 continuable subagent 之上，但多了 durable peer mailbox / task DAG。Subagent 通用控制：

| 控制项 | 对上下文的影响 |
|---|---|
| `inheritsParentContext` | **仅**对话种子（fork 前缀）；**不**继承工具 / 服务 / 权限 |
| `persona` | 子 `agent.ctx` shadow persona-prefix |
| `toolFilter` | 子 scope `restrict()`；提示段按可见工具省略 |
| `depth` / `maxDepth` | 委派深度上限 |
| `subagent:delegation` PromptContext | 只出现在 child 的 runtime 快照 |

跨 session 只读引用走 `session-reference`（`form: recall`），有界、防递归。

### 产品侧自检

- [ ] 新成员该 fresh 还是 fork？fork 是否只要 completed turns？
- [ ] 新事实属于 Lead 协调态（team 事件）还是某成员模型历史（user/system）？
- [ ] Peer 内容是否经 mailbox 投递，而不是直接改对方 surface？
- [ ] 工具 / policy 是否挂在成员 `agent.ctx`，避免非 Team subagent 误见？

---

## 两层如何咬合

```text
工程规则（B）
  └─ 每个 agent 的 Session surface + system-prompt 通道 + inject/form
        ↑ 产品（A）在其上叠加
        ├─ 多 Session 隔离对话
        ├─ Lead log 上的 team/* 协调（log-only）
        └─ mailbox → 目标 Session 的 sourced user/message（进模型）
```

换话说：Agent Teams **没有**另造一套「团队上下文管道」；它复用仓库统一的上下文工程纪律，只新增「协调态不进模型历史、对话用独立 Session」这一层产品语义。

## 权威阅读

**工程（B）**

- [如何组织上下文](2026-09-10-how-context-is-organized.md)（本目录）
- `docs/architecture.md`、`docs/cookbook/extension-cookbook.md`
- `packages/core/system-prompt/README.md`、`packages/context/README.md`
- Notes：`prompt-variables-and-tool-guidance-ownership`、`reconstructable-requests`、`agent-scope-contexts`、`separate-context-injection-from-turn-execution`、`context-form-vocabulary`、`system-prompt-as-surface-node`

**产品（A）**

- `docs/subsystems/agent-team.md`、`packages/experimental/agent-team/README.md`、`tool-agent-team/README.md`
- Notes：`2026-08-05-agent-teams`、`2026-07-12-subagent-persona-tool-filter-and-depth`
- `docs/subsystems/subagent.md`

## 结论

「团队的上下文工程」在本仓库 = **用所有权与通道管理贡献，用 Session log 保证可重建，用 ContextForm 管理呈现；多 agent 产品再在之上用独立 Session 隔离对话、用 Lead 日志共享协调，只把需要模型看见的 peer 内容显式投递为 user 消息。** 管理动作是改对所有者与扩展点，而不是维护一份游离的 prompt 手册。

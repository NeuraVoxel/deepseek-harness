# 006 · 四种 Agent Presets 对比

> DeepSeek Harness 源码专题 · 第 6 篇
> 接 [005 · AgentLoop](./005-解剖AgentLoop.md) · 地图见 [002](./002-目录结构与架构图.md) · 流程见 [000](./000-当前项目开发流程.md)
> 主线：随包交付的四个 preset 各装什么、差在哪、何时选哪个

AgentLoop 决定会话**怎么跑**；Agent Preset 决定会话**跑什么**——工具目录、人设、skill、委派与呈现方式。同一 Host 进程里可以同时挂多个 preset：每个会话命名一个，加入该 preset 的常驻组装。

权威入口：

| 入口 | 管什么 |
|---|---|
| [`packages/preset/agent-presets/README`](../packages/preset/agent-presets/README.zh.md) | roster、挂载、切换、创作约定 |
| [`packages/preset/agent-presets/presets/`](../packages/preset/agent-presets/presets/) | 四个随包交付的 `agent.cordis.yml` |
| [`packages/preset/persona`](../packages/preset/persona/README.zh.md) | preset 如何遮蔽部署级人设 |
| [`docs/architecture.md` · Application launch](../docs/architecture.md#application-launch) | Host vs Agent 平面（preset 不拥有沙箱/持久化/模型路由） |

---

## 先说结论

随包交付的四个 id（`display.ts` / `preset.yml` 的 roster `order`）：

| id | 显示名 | order | 一句话 |
|---|---|---|---|
| `standard` | 标准模式 | 1 | 完整编码 Agent；部署默认通常是它 |
| `ptc` | PTC 模式 | 2 | ≈ standard，但用 `run_code` SDK 组合多步；关掉 `workflow` |
| `minimal` | 极简模式 | 3 | 固定人设 + 持久 shell + `str_replace_editor` |
| `cordis` | 创造模式 | 4 | = standard + 读写运行时 / 创作其它 preset |

一句话：

> **Preset 是 Agent 平面的插件清单；沙箱、审批、持久化、模型路由仍在 Host。**
>
> **会话只有在尚无消息/工具调用时才能换 preset；之后组装固定到会话生命周期。**

---

## 1. 四个目录长什么样

```text
packages/preset/agent-presets/presets/
├── standard/
│   ├── preset.yml          # name / description / order
│   └── agent.cordis.yml    # ★ 本会话挂载的插件行
├── ptc/
│   ├── preset.yml
│   └── agent.cordis.yml
├── minimal/
│   ├── preset.yml
│   └── agent.cordis.yml
└── cordis/
    ├── preset.yml
    ├── agent.cordis.yml
    └── skills/             # 创造模式自带 composition 创作 skill
        ├── editing-cordis-compositions/
        └── cordis-plugin-development/
```

用户自写的 preset 落在 `${DSH_HOME:-$HOME/.dsh}/.agent-presets/<id>/`；创作是 **copy 既有目录**，不是手填组装文本。**不要改 shipped 安装目录**——升级会覆盖；改 `cordis` 自身还会毁掉创造模式。

---

## 2. 能力对照表

| 维度 | standard | ptc | minimal | cordis |
|---|---|---|---|---|
| Shell | 一次性 `bash`/`pwsh`（Host 沙箱） | 同左 | **持久** PTY（`tool-bash-persistent` / pwsh） | 同 standard |
| 文件 | `tool-fs` + `tool-fs-search` | 同左 | **`str_replace_editor`** + 本预设隔离 `fs-local` | 同 standard |
| Web / Skills / Goal / Plan / Todo / Ask | 有 | 有 | **无** | 有 |
| Compaction + tool-result prune | 有 | 有 | **无** | 有 |
| Subagent / fork / Ralph | 有 | 有 | **无** | 有 |
| `workflow` 工具 | **启用** | **disabled** | 无 | **启用** |
| 工具呈现 | 普通工具目录 | **`mode: ptc`** → 生成 SDK + `run_code` | 普通（仅两工具） | 普通 + **`tool-cordis`** |
| Persona | 可叠加载入提示词段落 | 同左 | **`complete: true`**；关 runtime context | 强调 Host vs Agent 两平面 |
| 附带 skill 根 | 普通 discovery | 同左 | 无 | preset 内 `skills/` |

相对 `standard` 的**文件级**差异（只列有意不同）：

| 相对 baseline | 改动 |
|---|---|
| **ptc** | `tool-workflow` → `disabled: true`；追加 `dsh-agent-tool-presentation`（`mode: ptc`） |
| **cordis** | 追加 `dsh-tool-cordis`；`skill-filesystem` 指向本目录 `skills/`；人设长文换两平面说明 |
| **minimal** | 整份重写：不是 standard 的子集剪枝，而是另一条双工具组装 |

---

## 3. 逐个拆开

### 3.1 `standard` — 基线全量

源文件：[`presets/standard/agent.cordis.yml`](../packages/preset/agent-presets/presets/standard/agent.cordis.yml)

挂载内容（按文件分段）：

- **身份**：`dsh-persona` + `dsh-agent-instructions`
- **Shell / FS**：一次性 bash|pwsh、`tool-fs`、`tool-fs-search`
- **Jobs / Skills / Goals**：`tool-jobs`、`skill-filesystem` + `tool-skill`、`command-goal` + `tool-goal`
- **Plan mode**：isolate 的 `plan-mode`（工具目录跨模式保持不变，靠提示词约束）
- **Compaction**：`compaction-basic` + `command-compact` + tool-result pruner
- **委派**：`subagent` / `subagent_fork`（continuable）；`codex` / `claude-code` 行默认 `disabled`；`workflow` + `ralph`
- **其余**：`ask_user`、`todo`、`tool-web`（含 fetch）

Host 仍拥有：工具/提示词注册表本体、沙箱与审批、持久化、模型路由、subagent **registry** 与 spawn/fork 后端。Preset 只贡献**面向模型的工具行**与本会话的 isolate 服务。

### 3.2 `ptc` — 同一工具面，换编排入口

源文件：[`presets/ptc/agent.cordis.yml`](../packages/preset/agent-presets/presets/ptc/agent.cordis.yml)

设计意图（文件头注释）：

> Most of `standard` is here unchanged. The deliberate exception is the general-purpose `workflow` tool: PTC mode uses `run_code` as its model-authored composition surface.

要点：

1. **关掉** `tool-workflow`，避免与 PTC 双轨（`ralph` 仍需要底下的 workflow **引擎**，所以 worker-thread 行保留）。
2. **挂上** `dsh-agent-tool-presentation`（`mode: ptc`）：把本会话解析到的工具注册表呈现为生成式 TypeScript SDK；模型写一段程序，一次 `run_code` 完成原本多轮的工具往返。
3. 该行依赖 Host 上的 `codeRuntime`；部署未组合 TypeScript runtime 时，**挂载本 preset 会失败**（fail loud），而不是拖到第一次请求。

适合：多步文件/搜索/shell 编排、希望减少 turn 往返。不适合：只想用经典「一工具一调用」交互、或 Host 没有 code-runtime。

### 3.3 `minimal` — 刻意另一条组装

源文件：[`presets/minimal/agent.cordis.yml`](../packages/preset/agent-presets/presets/minimal/agent.cordis.yml)

不是「standard 关掉一堆行」，而是：

| 选择 | 后果 |
|---|---|
| `persona.complete: true` | 系统提示**只有**这一段；全局 identity / Web 指引 / 其它段落进不来 |
| `includeRuntimeContext: false` | 无沙箱策略、审批策略等 runtime-context 快照 |
| 持久 shell（isolate `terminals`） | PTY 会话跨调用保状态；POSIX→bash，win32→pwsh |
| isolate `fs` + `str_replace_editor` | 本预设私有本地 fs；编辑器要绝对路径 |
| 无 compaction / web / skills / goal / plan / 委派 | 模型可见表面最小 |

适合：对照实验、只要「能跑命令 + 改文件」、或不想让完整工具目录干扰模型。注意：它用的是**持久 shell + 编辑器**，不是 Host 沙箱那对 `tool-bash` / `tool-fs`。

### 3.4 `cordis` — standard + 自指

源文件：[`presets/cordis/agent.cordis.yml`](../packages/preset/agent-presets/presets/cordis/agent.cordis.yml)

在 standard 能力之上：

1. **`dsh-tool-cordis`**：检查 live runtime、临时 `cordis_mount` / unmount。`cordis_mount` 会对模型写的 JavaScript 求值——文件头写明按 **shell 同级信任** 对待。
2. **preset 内 skill**：`editing-cordis-compositions`、`cordis-plugin-development`；`skill-filesystem.customSkillDirs` 指向本目录 `skills/`。
3. **人设**：写明 Host 平面 vs Agent Preset 平面；禁止改 shipped 安装；改行为 = copy 到 user root 再改。

适合：让 Agent 帮你写/调另一个 Agent preset、试验插件行。不适合：普通业务编码（信任面过大）。

---

## 4. 和 Host 平面怎么分边界

```text
┌──────────────────────── Host 组合（base + profile overlays）────────────────────────┐
│  registries · sandbox/approval · persistence · model route · subagent registry     │
│  codeRuntime（PTC 依赖）· settings · credentials …                                   │
└─────────────────────────────────────┬──────────────────────────────────────────────┘
                                      │ agentPresets.mount(agentCtx, id)
                                      ▼
┌──────────────────── Standing preset mount（进程内每 id 一份）─────────────────────────┐
│  agent.cordis.yml 的工具 / persona / skill / isolate 服务                              │
│  会话靠 scope 认父加入；兄弟 preset 互不可见                                            │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

记忆规则（创造模式 skill 也这么教）：

- **服务若有 Agent 外的消费者** → 留在 Host（例：`subagents` 注册表给 api-proxy 做跨会话查询）。
- **只服务一个会话的贡献** → 进 preset（工具行、人设、本会话 compaction）。
- **preset 里发服务** → 必须进带 `isolate` 的 group；否则进根 realm，第二个同名 preset 会撞车，挂载审计会拒。

---

## 5. 怎么选 / 怎么换

| 场景 | 选 |
|---|---|
| 日常写代码、改仓库 | `standard` |
| 希望模型用一段 TS 串多工具 | `ptc` |
| 最小工具面、对照、少干扰 | `minimal` |
| 创作/调试 preset 或试 Cordis 插件 | `cordis` |

切换约束（包 README）：

- 会话**尚未产出任何内容**（无消息、无工具调用）才能换。
- 切换记入 Session：`agent-preset/selected`；恢复/fork 按投影重建。
- 部署默认：`dsh-agent-presets` 的 `config.default`；用户可用 settings 命名空间 `agent-presets.default` 覆盖（只影响之后新建的会话）。

---

## 6. 跟读入口（按问题跳）

| 问题 | 打开 |
|---|---|
| 名单怎么扫、broken 怎么报 | [`src/discovery.ts`](../packages/preset/agent-presets/src/discovery.ts) |
| 常驻挂载 / 代际 / write 抑制 | [`src/mount.ts`](../packages/preset/agent-presets/src/mount.ts) |
| 空白会话如何换 preset | [`src/index.ts`](../packages/preset/agent-presets/src/index.ts) + [`src/session.ts`](../packages/preset/agent-presets/src/session.ts) |
| UI 文案键（四个内置 id） | [`src/display.ts`](../packages/preset/agent-presets/src/display.ts) |
| PTC 呈现如何吃注册表 | `@deepseek-ai/dsh-agent-tool-presentation` |
| 创造模式工具 | `@deepseek-ai/dsh-tool-cordis` |

本地摸一下（需 `DEEPSEEK_API_KEY`）：

```sh
pnpm dsh --profile headless "用 Bash 列出当前目录"   # 默认 standard 类组装
pnpm run demo:ptc -- "读 README 前 20 行并总结"       # PTC 呈现面
pnpm dsh web                                         # UI 里切换四个 preset（空白会话）
```

---

## 7. 和本专题其它篇

| 篇 | 关系 |
|---|---|
| [001 · hi](./001-一次hi对话的源码之旅.md) | 最短路径默认落在部署的 default preset 上 |
| [002 · 目录](./002-目录结构与架构图.md) | `packages/preset/` 在包组里的位置 |
| [005 · AgentLoop](./005-解剖AgentLoop.md) | Loop 跑 Turn/Step；**本篇**决定司机手里有哪些工具与提示词 |
| [004 · 双进程](./004-Web-UI双进程与dual-face.md) | preset 挂载与 AgentLoop 一样只在 Host；浏览器只选 id / 看投影 |

---

*本文为 wiki 专题稿，整理自当前 checkout 的 `packages/preset/agent-presets/presets/*` 与包 README；契约以那些文件与官方 docs 为准。*

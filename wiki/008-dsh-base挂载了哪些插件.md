# 008 · dsh-base 挂载了哪些插件

> DeepSeek Harness 源码专题 · 第 8 篇
> 接 [002 · 目录地图](./002-目录结构与架构图.md) · [006 · Presets](./006-四种Agent-Presets对比.md) · [007 · 设计模式](./007-Agent设计模式流程图.md) · 流程见 [000](./000-当前项目开发流程.md)
> 主线：base 组合包是什么、谁用它、一行一包对照表、默认关掉/按平台切换的行

随附的 `web` / `headless` / `sdk` / `acp` profile 都以 **`@deepseek-ai/dsh-base`** 为共享第一层：模型连接、完整工具集、持久会话、workspace 安全默认值都从这里来。
`sdk-minimal` **刻意不用** base，自己拥有完整独立配置树。

权威入口：

| 入口 | 管什么 |
|---|---|
| [`packages/bundle/base/cordis.patch.yml`](../packages/bundle/base/cordis.patch.yml) | ★ 本篇清单的真源：insert 行 + 行内注释 |
| [`packages/bundle/base/README.zh.md`](../packages/bundle/base/README.zh.md) | 组合包合同：谁叠它、如何覆盖 |
| [`apps/cli/composition.md`](../apps/cli/composition.md) | 生成的组合图（含 base 层） |
| [`docs/architecture.md` · Profiles](../docs/architecture.md#profiles-and-bundles) | Profile / Bundle 层序 |

---

## 先说结论

| 事实 | 含义 |
|---|---|
| Base = **一条静态 patch** | 对空 profile 根做一次 `insert`；不挂服务、不发事件 |
| 行数 | 当前 checkout 约 **85** 条 `id`（含同包多配置实例，如两个 `tool-subagent`） |
| 覆盖方式 | 后续 bundle / `cordis.patch.yml` / `--patch` **按 id 整行替换** config，不合并 |
| 模式相关行 | 值因 mode 而异的配置 **不** 放在 base；各 mode bundle 各自重述 |
| 行顺序 | **无**加载语义；激活由服务可用性驱动；分组只为阅读 |

一句话：

> **改 base 默认行为：优先改自己的 profile patch 或后置 bundle，而不是 fork 整份 base。**
>
> **本机核对：`pnpm dsh --profile headless --dump-config`（看叠完后的树，不只看 base）。**

---

## 1. Base 在组合里的位置

```text
空 entry 列表
  → dsh-base（本篇）
  → profile 列出的后续 bundles（如 web-app / headless / sdk-app / acp-app）
  → profile cordis.patch.yml
  → home 级 patch
  → --patch overlay
```

Preset（[006](./006-四种Agent-Presets对比.md)）在 **Agent 平面** 再挂会话级插件；沙箱、审批、持久化、模型路由仍在 Host，多数已由 base 提供。

---

## 2. 插件清单（按职责）

下列 `id` → 包名摘自当前 `cordis.patch.yml`。细节配置与 rationale 以文件内注释为准。

### 框架 / 核心脊柱

| id | package | 备注 |
|---|---|---|
| `timer` | `@deepseek-ai/cordis-plugin-timer` | |
| `hmr` | `@deepseek-ai/cordis-plugin-hmr` | **默认 `disabled: true`** |
| `llm` | `@deepseek-ai/dsh-llm` | |
| `session` | `@deepseek-ai/dsh-session` | |
| `agent` | `@deepseek-ai/dsh-agent` | |
| `tools` | `@deepseek-ai/dsh-tools` | |
| `system-prompt` | `@deepseek-ai/dsh-system-prompt` | `persona: ''` |
| `agent-loop` | `@deepseek-ai/dsh-agent-loop` | `agents: []` |
| `typert` | `@deepseek-ai/dsh-typert-registry` | |
| `typert-loader` | `@deepseek-ai/dsh-typert-loader` | |
| `typert-gateway` | `@deepseek-ai/dsh-api-gateway` | |

### LLM / 凭据 / 设置

| id | package | 备注 |
|---|---|---|
| `deepseek-llm-api-extensions` | `@deepseek-ai/dsh-deepseek-llm-api-extensions` | |
| `session-log-deepseek` | `@deepseek-ai/dsh-session-log-deepseek` | |
| `plugin-package-inventory-deepseek` | `@deepseek-ai/dsh-plugin-package-inventory-deepseek` | |
| `agent-default-model` | `@deepseek-ai/dsh-agent-default-model` | 默认 `deepseek-official` / `deepseek-v4-flash` |
| `llm-retry` | `@deepseek-ai/dsh-llm-retry` | |
| `settings` | `@deepseek-ai/dsh-settings-file` | `$DSH_HOME/settings.yaml` |
| `credentials` | `@deepseek-ai/dsh-credentials-local` | |
| `llm-pi-ai` | `@deepseek-ai/dsh-llm-pi-ai` | 无 `llm-pi-ai:` settings 时休眠 |
| `llm-deepseek` | `@deepseek-ai/dsh-llm-deepseek` | 密钥按请求解析，不内联 |

### Session 持久化 / 投影 / 遥测

| id | package | 备注 |
|---|---|---|
| `session-persistence-jsonl` | `@deepseek-ai/dsh-session-persistence-jsonl` | |
| `attachment-local` | `@deepseek-ai/dsh-attachment-local` | |
| `session-query-sqlite` | `@deepseek-ai/dsh-session-query-sqlite` | `openAt: never`（全文搜索关） |
| `session-projection` | `@deepseek-ai/dsh-session-projection` | |
| `storage` / `storage-json` / `storage-domain` | storage 栈 | |
| `session-projection-cache` | `@deepseek-ai/dsh-session-projection-cache` | |
| `session-telemetry-otel` | `@deepseek-ai/dsh-session-telemetry-otel` | 默认 `FEEDBACK_ONLY` |
| `session-title` | `@deepseek-ai/dsh-session-title` | |
| `session-title-llm` | `@deepseek-ai/dsh-session-title-first-prompt-llm` | |
| `session-checkpoint-policy` | `@deepseek-ai/dsh-session-checkpoint-policy` | |

### 沙箱 / 权限 / Shell / FS

| id | package | 备注 |
|---|---|---|
| `subprocess` | `@deepseek-ai/dsh-subprocess-local` | |
| `sandbox` | `@deepseek-ai/dsh-sandbox-local` | |
| `sandbox-policy` | `@deepseek-ai/dsh-sandbox-policy` | 默认 workspace-write |
| `bash-sandbox` | `@deepseek-ai/dsh-bash-sandbox` | **Win 上 disabled** |
| `pwsh-sandbox` | `@deepseek-ai/dsh-pwsh-sandbox` | **非 Win disabled** |
| `approval` | `@deepseek-ai/dsh-user-approval` | |
| `permission` | `@deepseek-ai/dsh-permission-presets` | |
| `shell-env` | `@deepseek-ai/dsh-shell-env` | |
| `tool-bash` / `tool-pwsh` | bash / pwsh 工具 | 平台二选一 |
| `fs-observation-policy` | `@deepseek-ai/dsh-fs-observation-policy` | |
| `tool-fs` / `tool-fs-search` | FS 工具 | |
| `fs-sandbox` | `@deepseek-ai/dsh-fs-sandbox` | 唯一文件写入路径约定 |

### 工具与 Agent 能力

| id | package | 备注 |
|---|---|---|
| `jobs` / `tool-jobs` | jobs-local + tool | |
| `user-questions` | `@deepseek-ai/dsh-user-questions` | |
| `agent-instructions` | `@deepseek-ai/dsh-agent-instructions` | |
| `skill` / `skill-filesystem` / `tool-skill` | skill 栈 | |
| `skill-badge` | `@deepseek-ai/dsh-skill-badge` | **默认 disabled** |
| `commands` | `@deepseek-ai/dsh-commands` | |
| `command-feedback` / `command-compact` / `command-goal` | 人命令 | |
| `goal` / `goal-round-driver` / `tool-goal` | Goal | |
| `plan-mode` | `@deepseek-ai/dsh-plan-mode` | |
| `token-meter` | `@deepseek-ai/dsh-token-meter` | |
| `compaction-basic` / `tool-result-pruner` | 压缩 | |
| `subagent` | `@deepseek-ai/dsh-subagent` | |
| `subagent-spawn-in-process` / `subagent-fork-in-process` | 委派 Provider | |
| `tool-subagent-control` / `tool-subagent-list-agents` | 全局控制 | |
| `tool-subagent` | spawn · `subagent` · continuable | 同包两行 |
| `tool-subagent-fork` | fork · `subagent_fork` · one-shot | |
| `workflow-worker-thread` / `tool-workflow` | workflow | |
| `timeout-policy` | `@deepseek-ai/dsh-tool-call-timeout-policy` | |
| `spill-local` / `spill-policy` | spill | |
| `tool-todo` / `tool-ralph` / `tool-str-replace-editor` | 任务 / Ralph / 编辑 | |
| `repeat-tool-reminder` | 重复工具提醒 | |
| `web` / `web-search-deepseek` / `web-fetch-http` / `tool-web` | 联网 | Web app 常禁用 host 行、改由 preset 组合 |

---

## 3. 默认关掉或按平台切换的行

| id | 条件 |
|---|---|
| `hmr` | 恒 `disabled: true`（live patch 用启动器 watch，不依赖本行） |
| `skill-badge` | 恒 `disabled: true` |
| `bash-sandbox` / `tool-bash` | `process.platform === 'win32'` 时 disabled |
| `pwsh-sandbox` / `tool-pwsh` | 非 Windows 时 disabled |
| `session-query-sqlite` | 服务挂着，但 `openAt: never` → 全文搜索关 |

---

## 4. 跟读与核对

```sh
# 叠完 profile 后的实际树（含 mode bundle + 用户 patch）
pnpm dsh --profile headless --dump-config

# 只读 base 真源
less packages/bundle/base/cordis.patch.yml
```

改默认模型、权限、工具多寡：编辑 **profile 的 `cordis.patch.yml`** 或后置 bundle，按 **id** 整行重述想保留的 config。
保持 `fs-sandbox` 为唯一文件写入路径；再叠普通 FS provider 会导致 profile 加载失败（见 base README）。

---

## 5. 和本专题其它篇

| 篇 | 关系 |
|---|---|
| [002 · 目录](./002-目录结构与架构图.md) | `packages/bundle/base` 在仓库地图中的位置 |
| [005 · AgentLoop](./005-解剖AgentLoop.md) | base 挂上 `agent` / `agent-loop` / `tools` / `system-prompt` |
| [006 · Presets](./006-四种Agent-Presets对比.md) | Host（多在 base）vs Agent 平面（preset 清单） |
| [007 · 设计模式](./007-Agent设计模式流程图.md) | Profile 组装 → Seam；base 即共享 Composition 第一层 |
| [000 · 流程](./000-当前项目开发流程.md) | 改组合行时证据与 doc 同步落点 |
| [009 · patch vs agent.cordis](./009-cordis.patch与agent.cordis的区别.md) | 本篇是典型 `cordis.patch.yml`；与 `agent.cordis.yml` 的平面差 |
| [010 · Host 启动顺序](./010-Host端内部启动顺序.md) | base 行在 Loader 并发窗口里何时相对 listen / appReady |
| [011 · 插件分组](./011-插件分组与主要作用.md) | 仓库全量包分组速查（本篇只列 base 实际挂上的子集） |

---

*本文为 wiki 专题稿，整理自当前 checkout 的 `packages/bundle/base/cordis.patch.yml` 与包 README；行集合随版本演进，以该文件与 `dsh --dump-config` 为准。*

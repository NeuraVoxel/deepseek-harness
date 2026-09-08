# 009 · cordis.patch.yml 与 agent.cordis.yml 的区别

> DeepSeek Harness 源码专题 · 第 9 篇
> 接 [006 · Presets](./006-四种Agent-Presets对比.md) · [008 · dsh-base](./008-dsh-base挂载了哪些插件.md) · [007 · 设计模式](./007-Agent设计模式流程图.md) · 流程见 [000](./000-当前项目开发流程.md)
> 主线：Profile 与 patch 差在哪；两份 YAML（`cordis.patch.yml` / `agent.cordis.yml`）各管哪一层

先分清 **Profile（具名组装）** 与 **patch（配置补丁层）**；再分清 Host 平面的 `cordis.patch.yml` 与 Agent 平面的 `agent.cordis.yml`。混用会导致「改了工具集却动到模型路由」或反过来。

权威入口：

| 入口 | 管什么 |
|---|---|
| [`docs/architecture.md` · Profiles and bundles](../docs/architecture.md#profiles-and-bundles) | profile / bundle / patch 层序 |
| [`docs/architecture.md` · Where new behavior goes](../docs/architecture.md#where-new-behavior-goes) | 「给会话不同能力集 → agent preset」 |
| [`packages/bundle/base/cordis.patch.yml`](../packages/bundle/base/cordis.patch.yml) | Host 共享第一层（patch 真源示例） |
| [`packages/preset/agent-presets/presets/*/agent.cordis.yml`](../packages/preset/agent-presets/presets/) | 四个随包 preset 的 Agent 平面清单 |
| [`packages/preset/agent-presets/README.zh.md`](../packages/preset/agent-presets/README.zh.md) | roster、挂载、切换、创作约定 |
| [`docs/user/develop/basic/publish.zh.md`](../docs/user/develop/basic/publish.zh.md) | 发布 bundle 时 `dsh.bundle.patch` 约定 |

---

## 先说结论

**Profile vs patch（组装身份 vs 补丁层）：**

| | Profile | Patch |
|---|---|---|
| 是什么 | `$DSH_HOME/profiles/<name>/` 下的**具名组装** | YAML **补丁数组**（按 `id` 整行替换或 `insert`） |
| 回答的问题 | 启动**哪套**应用组合（web / headless / sdk…） | 在当前叠层上**增删/覆盖哪些插件行** |
| 拥有什么 | bundle 列表、用户 `cordis.patch.yml`、可选 live reload、树外插件位 | 具体的 insert / 覆盖条目 |
| 关系 | Profile **选用**若干 bundle patch，并**自带**一层用户 patch | Profile 本身不是 patch；全量树 = 空列表 + 各层 patch |

**`cordis.patch.yml` vs `agent.cordis.yml`（Host 平面 vs Agent 平面）：**

| | `cordis.patch.yml` | `agent.cordis.yml` |
|---|---|---|
| 平面 | **Host / 进程** | **Agent / 会话 preset** |
| 回答的问题 | 这台机器上的 `dsh` **怎么启动、挂哪些进程级服务** | **这个会话**跑哪种 Agent（工具、人设、skill…） |
| 形态 | 对下层条目的 **patch 数组**（按 `id` 整行替换，或 `insert`） | 一份完整的 **composition 条目列表**（不是 patch） |
| 时机 | profile 启动（及 live reload，视 profile 而定） | 会话选用 / 切换 preset 时挂到常驻 scope |
| 粒度 | 整个 Node 进程一棵树 | 同一进程可并存多个 preset |
| 典型内容 | 模型路由、持久化、沙箱/审批、settings、HTTP/Web、headless runner | persona、tools、skill、plan/compaction、subagent **工具** |
| **不**该放 | 按会话切换的工具目录（应进 preset） | 沙箱、审批栈、持久化、模型路由（仍属 Host） |

一句话：

> **选 Profile = 选哪套应用；写 patch = 改那套里的插件行；写 `agent.cordis.yml` = 改某类会话的 Agent 能力集。**
>
> **Preset 是 Agent 平面的插件清单；沙箱、审批、持久化、模型路由仍在 Host。**

---

## 1. Profile 与 Patch

**Profile** 是 Harness home 里的具名组装（如 `web`、`headless`）。它声明叠哪些 **bundle**、是否 live reload，并保存该 profile 自己的用户 patch；树外插件也装在 profile 目录侧。

**Patch** 是一层配置动作：对「当前已叠出的条目列表」按 `id` **整行替换** config，或 `insert` 新行（不字段合并）。来源可以是 bundle 自带文件、profile / home 用户文件、或 CLI `--patch`。

```text
profile「web」
  ├── 声明 bundles: [dsh-base, dsh-web-app]   ← 每个 bundle 自带一份 cordis.patch.yml
  ├── profiles/web/cordis.patch.yml           ← 该 profile 的用户 patch 层
  └── （再叠）home 级 patch、--patch …
```

| 你想做的事 | 动什么 |
|---|---|
| 开 Web UI vs 一次性任务 | 选不同 **profile**（`dsh web` / `--profile headless`） |
| 在现有 web 上加一行 Host 插件或改模型默认 | 写 **patch**（profile / home / `--patch`） |
| 发布可复用的组合层 | 做 **bundle**（其产物仍是一份 `cordis.patch.yml`） |

核对某 profile 叠完后的全量树（不是单看某一份 patch）：

```sh
pnpm dsh --profile web --dump-config
```

启动时何时叠这些层，见 [010](./010-Host端内部启动顺序.md)。

---

## 2. `cordis.patch.yml` — Host 平面上的 patch

运行中的 `dsh` 是启动时从**有序层**叠出来的插件树。一层可以是 bundle 自带的 patch、profile 用户层、home 级偏好，或 CLI `--patch`。

层序（作用在**空** entry 列表上）：

```text
空 entry 列表
  → 各 bundle（profile 列出的顺序；如 dsh-base → web-app / headless …）
  → profile 自己的 cordis.patch.yml
  → home 级 $DSH_HOME/cordis.patch.yml
  → --patch overlay
```

语法要点：

- YAML **数组**，每项是一条 patch：按 `id` **整行替换**该行的 config（不字段合并），或 `insert` 新行。
- 覆盖必须重述该行需要的每一个键，不能只写改动的那个字段。
- 单看某一份 `cordis.patch.yml` **不是**全量配置；全量是叠完后的树。

谁会带一份：

| 位置 | 角色 |
|---|---|
| `packages/bundle/*/cordis.patch.yml` | 组合包贡献的层（`package.json` → `dsh.bundle.patch`） |
| `$DSH_HOME/profiles/<name>/cordis.patch.yml` | 该 profile 的用户持久偏好 |
| `$DSH_HOME/cordis.patch.yml` | 本机所有 profile 共享的偏好 |
| `dsh … --patch ./path.yml` | 单次启动 overlay |
| `plugins/*/cordis.patch.yml` | 可选插件 / 示例 bundle 的插入层 |

示例（headless 在 base 之上 insert 启动行，并覆盖部分已有 `id`）：

```yaml
# packages/bundle/headless/cordis.patch.yml（节选）
- id: system-prompt
  config:
    persona: >-
      You are a coding agent …

- insert:
    - id: headless-startup
      name: '@deepseek-ai/dsh-headless/startup'
    - id: headless-runner
      name: '@deepseek-ai/dsh-headless'
      …
```

更完整的 Host 第一层清单见 [008](./008-dsh-base挂载了哪些插件.md)。

---

## 3. `agent.cordis.yml` — Agent / Preset 平面

Agent Preset 是一个目录：`preset.yml`（显示名 / 描述 / order）+ **`agent.cordis.yml`**（本会话挂载的插件行）。

- 随包：`packages/preset/agent-presets/presets/<id>/agent.cordis.yml`（`standard` / `ptc` / `minimal` / `cordis`）。
- 用户自写：`${DSH_HOME:-$HOME/.dsh}/.agent-presets/<id>/`（创作方式是 **复制** 既有目录，不是手填整树）。

行为要点：

- 语法是普通 Cordis **条目列表**（`- id` / `name` / `config`…），**不是** patch。
- Roster 把每个 preset **挂一次**到常驻 scope；命名该 preset 的会话通过 scope 亲缘加入，共享工具与提示词段落；会话状态仍按 Session/Agent 隔离。
- 服务行若在 preset 里 `provide()`，必须落在带 **`isolate` realm** 的 group 内，否则会进根 realm、与其它 preset 冲突；`dsh-agent-presets` 在挂载时拒绝无 isolate 的服务行。
- Host 仍拥有：工具/子 agent **注册表**、沙箱与审批、持久化、模型路由。Preset 通常只贡献 model-facing Consumer（工具、persona、skill 层等）。

四种随包 preset 的能力差见 [006](./006-四种Agent-Presets对比.md)。

---

## 4. 一张图：两平面怎么叠

```text
                    ┌─────────────────────────────────────┐
  dsh --profile …   │  Host 平面（进程）                    │
                    │  cordis.patch.yml 各层叠出             │
                    │  · llm / sessions / sandbox / approval │
                    │  · tools·subagents 等「注册表」        │
                    │  · web / headless / sdk 入口           │
                    └─────────────────┬───────────────────┘
                                      │ 会话选 preset id
                                      ▼
                    ┌─────────────────────────────────────┐
  agent.cordis.yml  │  Agent 平面（按 preset 常驻挂载）      │
                    │  · persona / agent-instructions       │
                    │  · tool-bash、tool-fs、tool-web …      │
                    │  · skill / plan / compaction / 委派工具 │
                    │  （isolate 内的 per-preset 服务）      │
                    └─────────────────────────────────────┘
```

[007](./007-Agent设计模式流程图.md) 的记法同一件事：**Profile 决定装哪些 seam；Preset 决定本会话可见 Consumer；Loop 只编排。**

---

## 5. 选型速查

| 你想做的事 | 改哪份 |
|---|---|
| 开浏览器 UI vs 跑一题就退出 | 选不同 **profile**（`web` vs `headless`） |
| 换默认模型、API、权限策略 | 该 profile / home 的 `cordis.patch.yml`，或后置 bundle |
| 给 `web` 加一个进程级 Host 插件（HTTP、遥测…） | bundle 或 profile 的 `cordis.patch.yml` / `--patch` |
| 发布可安装组合包 | 包内 `cordis.patch.yml` + `dsh.bundle.patch` |
| 让某类会话少工具 / 换人设 / 开 PTC | 新或复制 preset，改其 `agent.cordis.yml` |
| 同一 Host 上同时跑「完整编码」和「极简」会话 | 两个 preset；会话各自选 id（尚无消息时可切换） |
| 只在一次启动里试插件 | `--patch`（仍是 Host 层）；会话能力差仍用 preset |

---

## 6. 和本专题其它篇

| 篇 | 关系 |
|---|---|
| [000 · 流程](./000-当前项目开发流程.md) | 改组装时证据与 doc 落点 |
| [006 · Presets](./006-四种Agent-Presets对比.md) | `agent.cordis.yml` 四个随包变体的能力对照 |
| [007 · 设计模式](./007-Agent设计模式流程图.md) | Composition vs Preset vs Loop 分层图 |
| [008 · dsh-base](./008-dsh-base挂载了哪些插件.md) | 典型 `cordis.patch.yml`（base）一行一包清单 |
| [002 · 目录](./002-目录结构与架构图.md) | `packages/bundle/` 与 `packages/preset/` 在地图中的位置 |
| [010 · Host 启动顺序](./010-Host端内部启动顺序.md) | patch 叠完之后 Loader / listen / 首个 preset 的时序 |

---

*本文为 wiki 专题稿，整理自当前 checkout 的 `docs/architecture`、bundle / preset README 与样例 YAML；契约以那些权威源为准，随版本演进时以当前 checkout 与 `dsh --dump-config` 核对。*

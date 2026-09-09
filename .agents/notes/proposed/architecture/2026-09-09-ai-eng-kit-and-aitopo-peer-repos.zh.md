# Agent Note: AI eng kit and aitopo peer repositories

Status: proposed

[English](2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md) | 中文

## Problem

DeepSeek Harness 已沉淀可复用的 AI 工程化实践（Agent Notes、AGENTS 站桩指令、skills、文档门禁，以及含覆盖率门禁与 fixture/snapshot 约定的测试工程策略）。这些实践困在本 monorepo 内，其他产品无法在不叉开 harness 流程代码的情况下采用。与此同时，`@neuravoxel/aitopo` 已作为 first-party 树落在 `vendor/aitopo`，并有私有远端 `git@github.com:NeuraVoxel/aitopo.git`，但继续留在 harness 工作区内会阻碍独立迭代，并迫使非 Cordis 库走 Cordis 式 vendor 记账。更早的 [AITopo dual-face 提案](2026-09-07-aitopo-dual-face-canvas-engine.zh.md) 有意把引擎留在仓内；该所有权选择已不再匹配「对等产品仓」的需求。

## Proposal

将三个 GitHub 项目视为**完全并列**的 peer（无父子权威）：

| Peer | Remote | Role |
|---|---|---|
| `ai-eng-kit` | `NeuraVoxel/ai-eng-kit`（计划中） | 可移植 AI 工程化工具包：Agent Notes 格式与 verify 门禁、AGENTS 模板、可安装 skills、可配置文档门禁、测试工程配方（覆盖率门禁模式、fixture/snapshot *约定*）。以可安装包发布（如 `@neuravoxel/ai-eng`），提供 `init` + `verify-*`。 |
| `aitopo` | `git@github.com:NeuraVoxel/aitopo.git`（私有） | Canvas 拓扑引擎（`@neuravoxel/aitopo`）。消费 `ai-eng-kit` 作为 agent 工作流与测试策略。引擎内无 React、Cordis、Session brand、或 `@deepseek-ai/dsh-*`。 |
| `deepseek-harness` | 本仓库 | Agent 产品。只消费 aitopo（不消费 kit，除非在 K1 下显式 cherry-pick）。托管将 Session 快照映射到 `GraphDocument` / patch 的 `agent-observe` 适配层。 |

### 权威模型（K1）

各 peer 按自身节奏演进。有用的改进可在 peer 间 **cherry-pick**。任一 peer 都不是另一 peer 树的实时权威。从 harness 流程文件播种 `ai-eng-kit` 是一次性（或偶尔）导出，不是持续的上下游关系。

### 进入 `ai-eng-kit` 的内容

- Agent Notes 的 lifecycle/class 树、统一格式、归档冻结策略，以及可移植的 `verify-agent-note-format`（及相关 note 门禁）。
- 根 / 包级 `AGENTS.md` **模板**，去掉 harness 专属规则（session 格式、Cordis vendor 同步、`dsh` profile 启动、capability-seam 词汇）。
- 可移植 skills：prose standard、archive-notes、可参数化的 pre-push checks、code-review、可选 trim-cot。
- 文档门禁骨架：链接检查、可配置预算、「当前态 / 一事实一处」政策说明。
- 测试工程：行为测试措辞政策；按 `src` 的覆盖率门禁**配方**；owner-local expected 与顶层 snapshot 的**约定**；薄的 fixture 回放骨架——**不含** harness 录制 session 的 profile 回放。

### 仅留在 deepseek-harness 的内容

- Agent-loop、Session JSONL、capability seams、Cordis vendor 钉扎与同步流程。
- `test:snapshot` 录制 session 语料与 shipped-profile 回放。
- 产品专属 skills 与门禁（`verify-cordis-config`、双语网站投影、`dsh-*` 包规则）。

### aitopo 对 kit 的消费

aitopo 安装或 submodule `ai-eng-kit`，在 CI 中跑其门禁，引擎文档/测试归 aitopo 所有。Session 驱动的 UI snapshot 在 `agent-observe` 集成时仍是 harness 的职责。

### deepseek-harness 对 aitopo 的消费（分阶段）

1. **Submodule（近期）：** 用钉扎到 `NeuraVoxel/aitopo` commit 的 git submodule 替换仓内 first-party 源码，路径仍为 `vendor/aitopo`。Workspace / `tsconfig` paths 继续解析 `@neuravoxel/aitopo`。`vendor/README.md` 写清 submodule 升级步骤，不再为引擎改动写 Cordis sync / first-party local-mod 长文。
2. **npm（之后）：** 发布 `@neuravoxel/aitopo`（私有 registry 或 org 允许的 restricted npm）；harness 依赖 semver 范围并退役 submodule。

### 迁移大纲

1. 立起 `NeuraVoxel/ai-eng-kit`：最小 `init` + notes 门禁 + 两三个可移植 skills + 测试政策文档。
2. 用当前 `vendor/aitopo` 填充 `NeuraVoxel/aitopo`（优先保留历史的 split；成本过高则可快照导入），接入 kit，CI 变绿。
3. 在 harness：将 `vendor/aitopo` 换成 submodule；更新 workspace/tsconfig/third-party-notices/vendor README；保持 typecheck/测试绿色。
4. 按 [vendor/aitopo/docs/2026-09-07-aitopo-agent-observe-integration.md](../../../../vendor/aitopo/docs/2026-09-07-aitopo-agent-observe-integration.md) 将 `plugins/agent-observe` 接到公开 Network/Patch API（路径随 submodule 移动）。
5. API 与发布节奏稳定后，发布 aitopo，harness 改为 registry 依赖。

### 与既有 aitopo note 的关系

本提案**取代** [2026-09-07-aitopo-dual-face-canvas-engine.zh.md](2026-09-07-aitopo-dual-face-canvas-engine.zh.md) 中「引擎作为 first-party 源留在 `vendor/aitopo`」的所有权决定。Dual-face 协议、clean-room 规则与引擎纯净性决定仍然有效。Editor 与集成 note 对产品行为仍然有效；变更的是仓库所有权与 harness 接线。

## Alternatives considered

- **Kit 仅作拷贝模板：** 否决——版本易漂移；aitopo 无法干净升级门禁/skills。
- **Kit 作为完整 starter monorepo：** 否决——对单一库消费者过重。
- **Harness 自身门禁依赖 kit（K2）：** 暂否决——迫使 harness 大迁移；K1 cherry-pick 保持 peer 独立。
- **aitopo 永远作为 `vendor/` first-party：** 否决——阻碍独立迭代，并误用 Cordis vendor 流程。
- **Harness 第一天就用 npm 消费 aitopo：** 否决——API 与发布节奏尚不稳；submodule 暂时保留 monorepo DX。
- **把 React/Session 适配放进 aitopo 仓：** 否决——破坏引擎纯净，并把图形库耦到 harness 类型。
- **ai-eng-kit 放在 deepseek-harness org / 层级化「从父仓抽取」：** 否决——三项目在 NeuraVoxel（kit + aitopo）与作为 aitopo 并列消费者的 harness 下明确为 peer。

## Acceptance criteria

- `NeuraVoxel/ai-eng-kit` 存在，有文档化的 `init`、至少一个可执行的 notes（或文档）门禁，以及可在 harness 外使用的可移植 skills。
- `NeuraVoxel/aitopo` 私有远端在无 harness monorepo 的情况下可 build / test / typecheck；kit 已接入其 agent 工作流/CI。
- Harness 的 `vendor/aitopo` 为 submodule 钉扎（或在后续阶段为 registry 依赖），且 `@neuravoxel/aitopo` 仍可被 workspace 消费者解析。
- aitopo 引擎包内无 React/Cordis/`@deepseek-ai/dsh-*` 依赖。
- `vendor/README.md`（及相关 notices 脚本）描述 peer/submodule（其后 npm）模型；Cordis sync 流程仍不适用。
- Harness 不将 `ai-eng-kit` 作为运行时或门禁依赖（K1）；任何复用均为显式 cherry-pick。
- 在 submodule 切换落地时，后续变更记录 dual-face note 的所有权修正（implemented 重写或交叉链接）。

## Risks

- **流程理念双轨维护（K1）：** harness 与 kit 可能分叉；用偶尔 cherry-pick 与 kit README 中简短的「可移植 vs harness-only」清单缓解。
- **Submodule DX 摩擦：** 贡献者需 init/update submodule；用 README + CI 在缺钉扎时明确失败缓解。
- **导入丢历史：** 快照导入失去 `vendor/aitopo` blame；可行时优先 subtree/filter split。
- **过早 npm 发布：** 不稳定的 Patch/Events 变更会打断 harness；在 observe 集成验收测试存在前保持 submodule。
- **范围蔓延到产品运行时抽取：** kit 不得吞入 agent-loop/session；用上文「仅留 harness」清单约束。

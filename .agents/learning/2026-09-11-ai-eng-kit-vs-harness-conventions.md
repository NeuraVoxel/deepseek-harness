# ai-eng-kit 与 deepseek-harness 规范对比

首次撰写：2026-09-11

> 学习笔记，非正式权威。关系与边界权威：[Agent Note — AI eng kit and aitopo peer repositories](../notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.md)。kit 侧 K1 范围见 sibling 仓 `ai-eng-kit` 内 Agent Note `2026-09-10-k1-kit-scope-boundary`（不在本仓树内，勿当本仓链接门禁目标）。

## 一句话

两边是 **K1 对等**：共享「Agent Note + 可移植流程骨架」，但 **harness 不依赖 `@neuravoxel/ai-eng` 跑自己的门禁**；kit 是精简可移植子集，harness 是完整产品规范，且已有若干 kit 侧新规则尚未回灌。

## 关系（先定边界）

| | ai-eng-kit | deepseek-harness |
|---|---|---|
| 角色 | 便携工具包 `@neuravoxel/ai-eng`（`init` / `verify-notes` / 3 个 portable skills） | 产品 monorepo；通过 `vendor/aitopo` submodule 消费 aitopo |
| 依赖 | 被 aitopo 等 peer 使用 | **故意不依赖 kit**（K1）；process 可独立演进，偶发 cherry-pick |
| 安装副作用 | — | 工作区 `pnpm install` 可能解析 aitopo 锁定的 kit git pin；**不等于** harness 用 kit 做门禁 |

## 仍然相同的骨架

- Agent Note 生命周期：`proposed` / `implemented` / `rejected`（+ `archived`）
- 分类：`feature` / `bug-fix` / `simplification` / `architecture` / `process` / `testing`
- 正文骨架：`Problem` + `Decision|Proposal` + `Alternatives considered` …
- 原则：非平凡改动写 Note；测试描述 behavior；显式 resolve/default；误配尽早失败；注释不写推理流水账

## 主要差异

### 1. `AGENTS.md` 体量与内容

- **kit**：约十几行可移植 standing orders（Note、设计稿落点、prose、boundary、测试、最小检查）。
- **harness**：完整产品命令——Cordis / Session、启动规则、包边界、vendor、coverage / snapshot、双语文档、PR / stack、`plugins/` 规则等。

### 2. Agent Notes 门禁深度

| | kit | harness |
|---|---|---|
| 语言 | 默认英文单文件 | **英/中 + `.i18n.yaml` 三元组** |
| 校验 | `ai-eng verify-notes` | `verify-agent-note-format` 等（在 `doc-sync` 里） |
| 归档冻结 | 流程约定；MVP **无** freeze manifest 硬门禁 | `verify-archived-agent-notes` **有**硬门禁 |
| 设计草稿落点 | 明确禁止默认写 `docs/superpowers/specs/`；进 `proposed/` 或 inbox | notes README **尚未**写这条；仓库里仍有 `docs/superpowers/{plans,specs}` |

### 3. Inbox

- **kit**：有 `.agents/inbox/`（灵感队列；中文优先；升格才进 `proposed/`）；**不**随 `ai-eng init` 下发。
- **harness**：没有 inbox 树；未成型想法多在 chat / learning / 历史 `docs/superpowers/` 路径。

### 4. 测试规范

| | kit `docs/testing-policy.md` | harness `docs/testing.md` |
|---|---|---|
| 覆盖率 | 建议 per-src，库起步约 **90% statements** | CI 门禁：`packages/*/*/src` **per-file 100%** |
| 快照 | 仅说 owner-local expected；**不**提供 session replay | 多层：unit / expected / **recorded-session snapshot** / web browser / e2e / bench |
| 入口 | 通用 Vitest 建议 | 真实 entry path、Loader 组合、built `lib/`、双 SDK 投影等 |

### 5. Skills

- **kit 可移植 3 个**：`prose-standard`、`archive-agent-notes`、`pre-push-checks`（命令是 `ai-eng verify-notes`）。
- **harness**：`dsh-*` 同源增强版 + 产品专用（`dsh-doc`、`dsh-translate-docs`、`dsh-merging-stacked-prs`、`record-browser-gif`、`dsh-ci-test-reliability` 等）。

### 6. 文档体系

- **kit**：`docs/` 只放消费者安全指引（基本就是 testing-policy）；维护者边界写在 Agent Note，不进 npm tarball。
- **harness**：双语配对、词表、文档预算、VitePress、catalogs、cookbook、postmortem、`docs/AGENTS.md` 整套标准。

### 7. 仅 harness 的产品 / 仓库规则

- 只改 `plugins/`、禁止改 `packages/` / `vendor/`、aitopo 以需求提案回 peer（见 `plugins/AGENTS.md`）
- Session format / model-visible ⟺ logged / capability seam
- Vendor Cordis 同步、`dsh` profile 启动、子模块与私有 token 安装链

## 实操含义

| 工作面 | 跟哪套规范 |
|---|---|
| harness / `plugins/agent-observe` | 本仓 `AGENTS.md`、`docs/testing.md`、`.agents/notes/README.md`、`plugins/AGENTS.md`；**不要**套 kit 的 90% coverage 或「无 bilingual」 |
| aitopo / 新 NeuraVoxel 小库 | kit（或该仓已 `init` 的模板）；**不要**搬 harness 的 session snapshot、双语门禁、Cordis 规则 |

kit 比 harness **更新、更严**的一点：设计稿默认进 `.agents/notes/proposed/`（或 inbox），禁止当用户文档堆在 `docs/superpowers/specs/`。harness 历史上仍在用 `docs/superpowers/`，这是目前最明显的规范漂移点。

## 相关路径（本机对照）

| 材料 | 路径 |
|---|---|
| kit 仓（sibling） | `~/Documents/AI/coding-agents/ai-eng-kit` |
| kit `AGENTS.md` / testing-policy | `ai-eng-kit/AGENTS.md`、`ai-eng-kit/docs/testing-policy.md` |
| harness 测试 / 文档标准 | `docs/testing.md`、`docs/AGENTS.md` |
| harness Agent Notes 格式 | `.agents/notes/README.md` |
| 插件 standing orders | `plugins/AGENTS.md` |

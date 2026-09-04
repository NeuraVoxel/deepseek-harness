# 001 — 根据 intent 生成 proposed 文档的处理流程

记录日期：2026-09-04

## 当前问题

根据 intent（用户意图 / 功能想法）生成 `proposed` 文档的处理流程是什么样的？走过哪些步骤？

## 结论（短答）

`proposed` 不是口头提案，而是进仓库的 **Agent Note 三件套 + 通常单独 PR**。

路径：

```text
.agents/notes/proposed/<class>/YYYY-MM-DD-kebab-title.md
.agents/notes/proposed/<class>/YYYY-MM-DD-kebab-title.zh.md
.agents/notes/proposed/<class>/YYYY-MM-DD-kebab-title.i18n.yaml
```

格式权威：[`.agents/notes/README.md`](../../.agents/notes/README.md)。

## 处理流程（步骤）

```text
intent（想法）
  → 1. 判定是否值得写 Agent Note
  → 2. 选 class / 路径 / 日期
  → 3. 搜现有 note（supersession）
  → 4. 写英文骨架（Problem → Proposal → Alternatives → Acceptance → Risks）
  → 5. 写中文对页 + pairing sidecar
  → 6. 本地门禁校验
  → 7. PR 提交（合入后仍停在 proposed/）
```

### 1. 澄清 intent

把模糊想法收成可写的决策：

- 现状问题是什么
- 期望行为是什么
- 成功如何可观察
- 刻意不做什么

纯机械小改可直接实现；行为 / 架构 / 跨包契约变化才进 `proposed/`。

### 2. 选 class 与路径

| class | 何时用 |
|---|---|
| `feature` | 用户/模型可见新能力 |
| `architecture` | 已发布源码结构/词汇决策 |
| `process` | 门禁、工具链、流程（非运行时） |
| `testing` | 测试策略/基础设施 |
| `bug-fix` | 修缺陷的设计决策 |
| `simplification` | 删减而不加能力 |

- 日期 = **首次提出**当天
- 标题用 kebab-case，描述主题，不要带 `proposed`

### 3. supersession 检查

在 active tree（`proposed/` / `implemented/` / `rejected/`）搜同类决策。能并入已有 note 就更新它，不要重复开一份。

**必调 skill：** [`dsh-archive-agent-notes`](../../.agents/skills/dsh-archive-agent-notes/SKILL.md) — 每写新 note 都要扫同类决策、归类全/部分 supersession；合格的 implemented 三件套同 PR 归档。权威：[`.agents/notes/AGENTS.md`](../../.agents/notes/AGENTS.md)。

`class=simplification` 或任务是「找可删减面」时，先走 [`dsh-find-simplifications`](../../.agents/skills/dsh-find-simplifications/SKILL.md)，再落 proposed。

### 4. 写英文 proposed 骨架

前三行必须为：

```markdown
# Agent Note: <title>

Status: proposed
```

正文必填：

| 节 | 写什么 |
|---|---|
| `## Problem` | 没有方案也能看懂的动机 |
| `## Proposal` | 打算怎么做（可用将来时） |
| `## Alternatives considered` | 每个真实备选 + 为何落选（禁止空段） |
| `## Acceptance criteria` | 可观察的完成标准 |
| `## Risks` | 风险 + 故意放弃的东西 |

可选质量 skill（非硬门槛）：[`dsh-prose-standard`](../../.agents/skills/dsh-prose-standard/SKILL.md)、[`dsh-trim-cot-leakage`](../../.agents/skills/dsh-trim-cot-leakage/SKILL.md)。

### 5. 写中文对页 + pairing

- 结构、行数与英文对齐
- `# Agent Note:` 与 `Status: proposed` **保持英文原文**
- 作者直接写中文对页；**不要默认**调 [`dsh-translate-docs`](../../.agents/skills/dsh-translate-docs/SKILL.md)（仅用户显式调用）
- 写完后执行：

```sh
pnpm run verify-translation-pairing --write .agents/notes/proposed/<class>/YYYY-MM-DD-kebab-title.md
```

### 6. 本地校验

```sh
pnpm run verify-agent-note-format
pnpm run verify-agent-note-classification
# 或更稳妥：
pnpm run doc-sync
```

### 7. 用 PR 提交 proposed

1. 开分支，建议只放 note 三件套（大功能先提案对齐，再写码）
2. Push 前按 [`dsh-pre-push-checks`](../../.agents/skills/dsh-pre-push-checks/SKILL.md) 选相关证据（docs-only 至少 `doc-sync`）
3. Commit / Push / `gh pr create`
4. 打标：提案为主通常 `kind/doc` + 至少一个 `area/*`
5. PR 描述链到该 Agent Note，写清要评审的决策点与 Acceptance

合入后文件仍在 `proposed/`。真正落地时迁到 `implemented/`（改 `Status` 与骨架）；否决则迁 `rejected/`，`Status: rejected — <一行原因>`。

## Skill / 工具速查（intent → proposed）

| 何时 | Skill / 命令 | 必做？ |
|---|---|---|
| 步骤 3 supersession | `dsh-archive-agent-notes` | **是**（每写新 note） |
| class=`simplification` | `dsh-find-simplifications` | 该场景是 |
| 步骤 4–5 正文质量 | `dsh-prose-standard` / `dsh-trim-cot-leakage` | 可选 |
| 步骤 5 配对 sidecar | `pnpm run verify-translation-pairing --write <en.md>` | **是** |
| 步骤 6 门禁 | `verify-agent-note-format` / `verify-agent-note-classification` 或 `doc-sync` | **是** |
| 步骤 7 push 前 | `dsh-pre-push-checks` | **是** |
| 中文翻译流水线 | `dsh-translate-docs` | **否**（仅用户显式） |
| 文档/网站投影 | `dsh-doc` | **否**（不管 Agent Note 骨架） |

仓库**没有**单独的 `intent→proposed` / `dsh-write-proposed` skill；流程权威是 [Agent Notes 规则](../../.agents/notes/README.md) + 上表。

## 本仓实例

intent：「Turn usage 面板增加实际金钱消耗统计」

产物：

- [`.agents/notes/implemented/feature/2026-09-04-turn-usage-money-cost.md`](../../.agents/notes/implemented/feature/2026-09-04-turn-usage-money-cost.md)
- `.zh.md` / `.i18n.yaml`

## 相关权威来源

- [Agent Notes 规则](../../.agents/notes/README.md) — 生命周期、格式、何时写
- [`.agents/notes/AGENTS.md`](../../.agents/notes/AGENTS.md) — 新 note 触发 supersession
- [根 AGENTS.md](../../AGENTS.md) — 非平凡改动必须含 Agent Note
- 更广交付路径：[002-adlc-full-lifecycle.md](002-adlc-full-lifecycle.md)

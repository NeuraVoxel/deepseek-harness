# Agent Note: Plugin-local kit Agent Notes (agent-observe pilot)

Status: proposed

[English](2026-09-11-plugin-local-kit-agent-notes.md) | 中文

## Problem

`plugins/` 下的可选包不是 `packages/` 下的产品包，但非平凡的插件改动仍把 Agent Note 写进根 `.agents/notes/`，并继承 harness 双语与 `doc-sync` 期望。运行时挂载本已分离（`--patch` / `dsh plugin`），流程所有权却没有：插件 UX 决策污染产品 Note 清单，若插件日后离开 monorepo，决策史也无法随包带走。[K1 peer 仓](../../implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md) 要求 harness 产品门禁不依赖 `@neuravoxel/ai-eng`；在仍给插件可移植 Note 门禁的同时必须保持这一点。

## Proposal

插件继续作为 pnpm workspace 成员以便联调。每个采用本约定的插件自有 kit 形态的 `.agents/` 树。仅在 `plugins/agent-observe` 试点。

### Authority

| 改动范围 | Note 归属 | 门禁 |
|---|---|---|
| `packages/`、`apps/`、harness 流程或产品契约 | 根 `.agents/notes/`（双语 + `doc-sync`） | 现有 harness 门禁 |
| 仅属 `plugins/agent-observe/**` 的行为 | `plugins/agent-observe/.agents/notes/`（kit：英文单文件） | `pnpm --filter dsh-agent-observe run verify-notes` |
| harness API 变更加插件适配 | 各树各写一条（根记契约、插件记适配）；禁止只在根树描述仅插件 UI | 各自门禁 |

仅改插件树且不改变 `packages/` 契约的 PR **不要求**根 Agent Note。非平凡插件决策必须写在插件树下。

### Scaffold (observe)

在 `plugins/agent-observe/` 下：

- 在**插件**根执行 `pnpm exec ai-eng init .`（或 `--upgrade`）——绝不在 monorepo 根执行。
- kit 拥有的 `AGENTS.md`，并短指针指向 [`plugins/AGENTS.md`](../../../../plugins/AGENTS.md) 中的 harness 插件站立禁令（勿改 `packages/` / `vendor/`）。
- `.agents/notes/` 生命周期目录；init 可选附带 portable skills。
- init 产生的 `docs/testing-policy.md` 仅作 Note/流程参考；**不**替代 harness `docs/testing.md`，也不把 kit 约 90% 覆盖率强加给插件。
- 将 `@neuravoxel/ai-eng` 列为 observe 的 **devDependency**，并加脚本 `"verify-notes": "ai-eng verify-notes .agents/notes"`。
- 脚手架落地后，在插件树内再写一条 implemented Note 记录本流程决策（证明校验通路）。

### Root / plugins documentation

更新根 `AGENTS.md`（一句指针）与 `plugins/AGENTS.md` / `plugins/README.md`，使豁免与 Note 归属可发现。不要让根 `doc-sync` 去扫 `plugins/*/`。

### Migration

本试点不搬迁已有提及 agent-observe 的根 Note（例如按 Turn 钉住流程）。日后可选地把仅插件历史迁到插件树并交叉链接；试点 PR 不做批量改写。

## Alternatives considered

- **仅约定、无 `verify-notes`：** 否决——无机械门禁则格式易漂；与选定的 kit 严格度冲突。
- **整棵 `plugins/.agents/` 共用：** 否决——日后拆单包更难带走；试点要按包可提取。
- **只把插件从根 Note 门禁挖出：** 否决——能停根污染，但插件决策仍无归属且无校验的树。
- **现在就把插件拆成独立 git 仓：** 否决——损失 monorepo 联调；workspace + 本地 kit notes 是中间形态。
- **harness 根依赖 kit 做产品门禁（K2）：** 否决——与 [K1](../../implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md) 冲突；kit 只作插件本地工具。

## Acceptance criteria

- `plugins/agent-observe` 具备 kit `.agents/notes/`、带 `plugins/AGENTS.md` 指针的插件 `AGENTS.md`，以及通过的 `verify-notes` 脚本。
- 根仓 / `plugins` 文档写明 Note 归属表与插件-only PR 的根 Note 豁免。
- 根 `package.json` 仍不因 harness 产品门禁而声明 `@neuravoxel/ai-eng`。
- 根 `doc-sync` / Note 格式门禁仍只扫根 `.agents/notes/`。
- 试点不为 orchestrator、turn-cost 或 hello-* 铺脚手架。
- 脚手架后有一条插件本地 Note 记录 observe 的 kit-notes 决策。

## Risks

- 贡献者仍可能凭习惯把插件 UX Note 写进根树，需文档与 review 纠正。
- 插件旁的 kit `testing-policy.md` 可能被误读为覆盖率硬门禁；插件 `AGENTS.md` 必须写明其仅供参考。
- observe 钉住 `@neuravoxel/ai-eng` 需要与 aitopo kit pin 相同的私有读安装通路。
- 关于 observe 的历史根 Note 在可选迁移前与新树分置。

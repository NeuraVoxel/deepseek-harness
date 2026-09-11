# Agent Note: Plugin-local kit Agent Notes (agent-observe pilot)

Status: implemented

[English](2026-09-11-plugin-local-kit-agent-notes.md) | 中文

## Problem

`plugins/` 下的可选包不是 `packages/` 下的产品包，但非平凡的插件改动仍把 Agent Note 写进根 `.agents/notes/`，并继承 harness 双语与 `doc-sync` 期望。运行时挂载本已分离（`--patch` / `dsh plugin`），流程所有权却没有：插件 UX 决策污染产品 Note 清单，若插件日后离开 monorepo，决策史也无法随包带走。[K1 peer 仓](../architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md) 要求 harness 产品门禁不依赖 `@neuravoxel/ai-eng`；在仍给插件可移植 Note 门禁的同时必须保持这一点。

## Decision

插件继续作为 pnpm workspace 成员以便联调。每个采用本约定的插件可自有 kit 形态的 `.agents/` 树。仅在 `plugins/agent-observe` 试点。

### Authority

| 改动范围 | Note 归属 | 门禁 |
|---|---|---|
| `packages/`、`apps/`、harness 流程或产品契约 | 根 `.agents/notes/`（双语 + `doc-sync`） | 现有 harness 门禁 |
| 仅属 `plugins/agent-observe/**` 的行为 | `plugins/agent-observe/.agents/notes/`（kit：英文单文件） | `pnpm --filter dsh-agent-observe run verify-notes` |
| harness API 变更加插件适配 | 各树各写一条（根记契约、插件记适配）；禁止只在根树描述仅插件 UI | 各自门禁 |

仅改插件树且不改变 `packages/` 契约的 PR **不要求**根 Agent Note。非平凡插件决策必须写在插件树下。

### Scaffold (observe)

`plugins/agent-observe` 已有 kit `AGENTS.md`（含标记）、`.agents/notes/`、portable skills，以及仅供参考的 `docs/testing-policy.md`。kit 段之后指向 [`plugins/AGENTS.md`](../../../../plugins/AGENTS.md)。`@neuravoxel/ai-eng` 是 observe 的 **devDependency**。`pnpm run verify-notes` 运行 `scripts/verify-notes.mjs`，调用 kit 公开的 `verifyAgentNoteFormat` API（pnpm symlink 下 `ai-eng` bin 的 direct-run 检查不会执行）。插件内记录见 [Observe package uses kit Agent Notes](../../../../plugins/agent-observe/.agents/notes/implemented/process/2026-09-11-observe-kit-agent-notes.md)。

根 `doc-sync` 不扫 `plugins/*/`。根 `package.json` 不为产品门禁声明 `@neuravoxel/ai-eng`。

### Migration

本试点不搬迁已有提及 agent-observe 的根 Note。日后可选地把仅插件历史迁到插件树并交叉链接。

## Alternatives considered

- **仅约定、无 `verify-notes`：** 否决——无机械门禁则格式易漂；与选定的 kit 严格度冲突。
- **整棵 `plugins/.agents/` 共用：** 否决——日后拆单包更难带走；试点要按包可提取。
- **只把插件从根 Note 门禁挖出：** 否决——能停根污染，但插件决策仍无归属且无校验的树。
- **现在就把插件拆成独立 git 仓：** 否决——损失 monorepo 联调；workspace + 本地 kit notes 是中间形态。
- **harness 根依赖 kit 做产品门禁（K2）：** 否决——与 [K1](../architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md) 冲突；kit 只作插件本地工具。

## Consequences

- 仅 observe 的决策落在插件 kit 树；harness 双语 notes 仍管产品契约。
- 贡献者仍可能凭习惯把插件 UX Note 写进根树，需文档与 review 纠正。
- 插件旁的 kit `testing-policy.md` 仅供参考；包测试仍属 owner-local。
- 关于 observe 的历史根 Note 在可选迁移前与新树分置。
- 计划：[docs/superpowers/plans/2026-09-11-plugin-local-kit-agent-notes.zh.md](../../../../docs/superpowers/plans/2026-09-11-plugin-local-kit-agent-notes.zh.md)。

## Testing

- `pnpm --filter dsh-agent-observe run verify-notes`
- `pnpm --filter dsh-agent-observe test`
- `pnpm --filter dsh-agent-observe exec tsc -b --pretty false`

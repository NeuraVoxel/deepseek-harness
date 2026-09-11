# Plan: Plugin-local kit Agent Notes (agent-observe pilot)

[English](2026-09-11-plugin-local-kit-agent-notes.md) | 中文

> **给执行代理：** 按任务顺序做，默认一个 PR。规格：[.agents/notes/implemented/process/2026-09-11-plugin-local-kit-agent-notes.md](../../.agents/notes/implemented/process/2026-09-11-plugin-local-kit-agent-notes.md)。

**目标：** `plugins/agent-observe` 自有 kit 形态 Agent Notes（`ai-eng verify-notes`）；仅插件 PR 不再强制根 `.agents/notes/`；harness 产品门禁保持 K1（根不依赖 kit）。

**非目标：** 其它插件脚手架；搬迁历史根 observe Note；根 CI/`doc-sync` 扫 `plugins/*/`；拆独立 git 仓。

## Task 1 — observe 加 kit 依赖并 init

1. 仓库根为 observe 增加与 workspace 一致的 kit pin（优先与 aitopo/lockfile 相同，例如 `github:NeuraVoxel/ai-eng-kit#v0.1.6`）：
   ```sh
   pnpm --filter dsh-agent-observe add -D github:NeuraVoxel/ai-eng-kit#v0.1.6
   ```
2. 在 `plugins/agent-observe/`：
   ```sh
   pnpm exec ai-eng init .
   ```
3. 确认：`README.md` / `README.zh.md` 未被覆盖；新建带 `<!-- ai-eng:begin -->` … `<!-- ai-eng:end -->` 的 `AGENTS.md`；`.agents/notes/` 生命周期目录与 notes README；`.agents/skills/`；`docs/testing-policy.md`。
4. 在插件 `AGENTS.md` 的 `<!-- ai-eng:end -->` **之后**加产品段：
   - 指向 [`../AGENTS.md`](../../plugins/AGENTS.md)（禁止改 `packages/` / `vendor/`）。
   - Note 归属：非平凡仅 observe 决策 → `.agents/notes/`（kit 英文）；仅插件 PR 不要求根 Note。
   - `docs/testing-policy.md` 仅作 Note/流程参考；测试仍用 `test` / `typecheck`；不适用 kit ~90% 覆盖率。
5. `plugins/agent-observe/package.json` 增加：
   ```json
   "verify-notes": "ai-eng verify-notes .agents/notes"
   ```

**验证：** `pnpm --filter dsh-agent-observe run verify-notes` 对空生命周期树退出码 0。

## Task 2 — 插件本地决策 Note（打通门禁）

1. 新增 `plugins/agent-observe/.agents/notes/implemented/process/2026-09-11-observe-kit-agent-notes.md`（kit：仅英文；`Status: implemented`；Problem / Decision / Alternatives considered / Consequences）。
2. Decision：observe 使用本包 kit notes；根双语 notes 仍管 harness 契约；链到根 process Note（相对路径上溯到仓库 `.agents/notes/...`）。
3. 插件树下**不要**加 `.zh.md` / `.i18n.yaml`。

**验证：** `pnpm --filter dsh-agent-observe run verify-notes` 仍绿。

## Task 3 — 根仓 / plugins 文档豁免

1. `plugins/AGENTS.md` — 站立规则：opted-in 插件可自有 kit `.agents/notes/`；试点为 `agent-observe`；仅插件 PR 写该树并跑包内 `verify-notes`；链根 process Note。
2. `plugins/README.md` + `README.zh.md` — 一条 Note 归属 / 试点说明。
3. 根 `AGENTS.md` — conventions 或 Agent Notes 处**一行**指针：opted-in 插件决策见 `plugins/AGENTS.md`；勿撑爆 standing-order 预算。
4. 可选：`plugins/agent-observe/README.md`（+ `.zh.md`）Notes 下一句。

**验证：** 若改了根 `AGENTS.md` 则跑 `pnpm run verify-doc-budgets`；文档 `git diff --check`。

## Task 4 — 脚手架落地后提升根 process Note

与 Task 1–3 **同一 PR**：

1. 将 `.agents/notes/proposed/process/2026-09-11-plugin-local-kit-agent-notes.{md,zh.md,i18n.yaml}` 移到 `implemented/process/`。
2. 英/中改写：`Status: implemented`；`## Proposal` → 现在时 `## Decision`；Acceptance / Risks 并入 `## Consequences`（可选 `## Testing` 写明 verify-notes 命令）。
3. `pnpm run verify-translation-pairing --write` 重录 sidecar。
4. grep basename，修好入站链接。

**验证：** 对该对跑 pairing；本文件生命周期格式正确（全仓 `verify-agent-note-format` 若因无关旧 Note 红，不扩大修复范围）。

## Task 5 — 推送前本地证据

```sh
pnpm --filter dsh-agent-observe run verify-notes
pnpm --filter dsh-agent-observe test
pnpm --filter dsh-agent-observe exec tsc -b --pretty false
```

除非 Task 3/4 触及 pairing 以外的 doc-sync 面，否则不跑完整 `doc-sync`。

## 完成标准

- [ ] observe 有 kit 树 + 绿的 `verify-notes` + 插件内一条 implemented process Note。
- [ ] 根 / plugins 文档写明豁免与 Note 归属。
- [ ] 根 process Note 已在 `implemented/` 且双语一致。
- [ ] 根 `package.json` 仍不为产品门禁声明 `@neuravoxel/ai-eng`。

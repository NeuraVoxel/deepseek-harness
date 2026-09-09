# AI eng kit MVP 实施计划

[English](2026-09-09-ai-eng-kit-mvp.md) | 中文

> **给 agentic worker：** 代码块与精确文件内容以 [英文版](./2026-09-09-ai-eng-kit-mvp.md) 为准。实现时使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。

**目标：** 立起 peer 仓 `NeuraVoxel/ai-eng-kit`，交付 `@neuravoxel/ai-eng`（`init`、Agent Note 格式校验、三个可移植 skills、测试政策文档）。

**架构：** 单 npm 包（ESM）。CLI `ai-eng` 分发 `init` / `verify-notes`。门禁为 harness `verify-agent-note-format` + `agent-note-tree` 的可移植子集（无 Cordis、无双语 pairing、MVP 无 archive 冻结门禁）。

**技术栈：** Node `^22.19 \|\| >=24`、TypeScript、vitest、tsx、tsc。

**规格 / 索引：** 见英文版链接。

---

### Task 1：创建 GitHub 仓并 clone

- [ ] `gh repo create NeuraVoxel/ai-eng-kit --private …`
- [ ] `git clone git@github.com:NeuraVoxel/ai-eng-kit.git ~/src/ai-eng-kit`

### Task 2：包骨架 + 失败中的 format 测试 → 实现门禁

- [ ] 写入 `package.json` / `tsconfig.json` / `vitest.config.ts`（见英文版）
- [ ] 写 `tests/agent-note-format.spec.ts` + fixture；先跑红
- [ ] 移植并导出 `verifyAgentNoteFormat(notesRoot)` / `walkAgentNoteTree(notesRoot)`
- [ ] 测试变绿后 commit

### Task 3：CLI `verify-notes` + `init`

- [ ] 写 `tests/init.spec.ts`（断言无 `deepseek-harness` / `cordis` 字符串）
- [ ] 添加 `templates/`、`skills/{prose-standard,archive-agent-notes,pre-push-checks}/`
- [ ] 实现 `initProject`、`cli.ts`；默认不覆盖已有 README/AGENTS（可加 `--force`）
- [ ] 写 `docs/testing-policy.md`、`docs/portable-vs-harness.md`
- [ ] 手工 smoke：`ai-eng init` + `verify-notes`；commit

### Task 4：CI + README + 自托管 Notes

- [ ] `.github/workflows/ci.yml`：typecheck、test、verify-notes
- [ ] 对 kit 仓自身 `init`；补 implemented Agent Note
- [ ] push，确认 Actions 绿

## Part 1 验收

- [ ] CI 绿；`init` 可用；无 agent-loop/session 代码
- [ ] 停止，进入 aitopo standup 计划

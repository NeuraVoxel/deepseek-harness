# AITopo peer 仓起立实施计划

[English](2026-09-09-aitopo-peer-repo-standup.md) | 中文

> **给 agentic worker：** 命令与配置以 [英文版](./2026-09-09-aitopo-peer-repo-standup.md) 为准。须先完成 [ai-eng-kit MVP](./2026-09-09-ai-eng-kit-mvp.zh.md)。

**目标：** 用 harness `vendor/aitopo` 填充私有远端 `git@github.com:NeuraVoxel/aitopo.git`，脱离 monorepo 可 build/test，并接入 `@neuravoxel/ai-eng`。

**架构：** subtree split（优先）或 rsync 快照；自包含 `tsconfig.json`；kit 以 `github:NeuraVoxel/ai-eng-kit#main` 作 devDependency；CI 跑 test / typecheck / verify-notes。

---

### Task 1：clone 并导入

- [ ] `git clone git@github.com:NeuraVoxel/aitopo.git ~/src/aitopo`
- [ ] 尝试 `git subtree split -P vendor/aitopo`；失败则 rsync 快照（README 标明路径）
- [ ] commit 导入

### Task 2：独立 TypeScript + 测试绿

- [ ] 去掉对 `../../tsconfig.base.json` 的 extends
- [ ] `pnpm install && pnpm run typecheck && pnpm test`
- [ ] 纯度检查：`src/` 无 cordis / `@deepseek-ai/dsh-*` / react
- [ ] commit

### Task 3：接入 ai-eng-kit

- [ ] `pnpm add -D github:NeuraVoxel/ai-eng-kit#main`
- [ ] `pnpm exec ai-eng init .`（保留产品 README）
- [ ] 写 implemented Agent Note：peer 仓决策
- [ ] `pnpm run verify-notes && pnpm test`；commit

### Task 4：GitHub Actions

- [ ] 添加 ci.yml；私有 kit 依赖需配置 git 鉴权 secret
- [ ] push 并确认绿

## Part 2 验收

- [ ] 无 harness checkout 即可 typecheck/test
- [ ] kit 已接线；远端已更新
- [ ] 停止，进入 harness submodule 计划

# Harness aitopo submodule 切换实施计划

[English](2026-09-09-harness-aitopo-submodule.md) | 中文

> **给 agentic worker：** 命令以 [英文版](./2026-09-09-harness-aitopo-submodule.md) 为准。须先完成 [aitopo standup](./2026-09-09-aitopo-peer-repo-standup.zh.md)，且 `NeuraVoxel/aitopo` `main` 已绿。

**目标：** 在 deepseek-harness 用钉扎到 `NeuraVoxel/aitopo` 的 git submodule 替换仓内 `vendor/aitopo` 源码；更新 vendor 文档/notices；将 peer Agent Note 转为 implemented。**不**引入 `ai-eng-kit` 依赖（K1）。

---

### Task 1：预检

- [ ] 记录 `origin/main` SHA 为 `AITOPO_SHA`
- [ ] 在 harness 开 `chore/aitopo-submodule`；先提交已写的 proposed note 与 plans（若未提交）

### Task 2：删除仓内源并加 submodule

- [ ] 仓外备份：`tar … /tmp/aitopo-vendor-backup.tgz`
- [ ] `git rm -r vendor/aitopo`
- [ ] `git submodule add git@github.com:NeuraVoxel/aitopo.git vendor/aitopo` 并 checkout `AITOPO_SHA`
- [ ] 确认 `package.json` name 仍为 `@neuravoxel/aitopo`

### Task 3：更新 README / notices / development

- [ ] `vendor/README.md`：aitopo 改为 submodule 说明；删除 in-tree local-mod 条目 20–29；增加升级步骤
- [ ] 保持 `parseFirstPartyVendorDirs(…).has('aitopo') === true`
- [ ] `docs/development.md`(+zh)：补充 `--recurse-submodules`
- [ ] 可选：缺 `vendor/aitopo/package.json` 时 CI/脚本明确失败

### Task 4：Agent Notes

- [ ] 将 `2026-09-09-ai-eng-kit-and-aitopo-peer-repos` 从 proposed 迁到 implemented，改写为 Decision/Consequences
- [ ] 修复 inbound 链接；`pnpm run verify-agent-note-format`

### Task 5：安装、测试、提交

- [ ] `pnpm install`
- [ ] `pnpm --filter @neuravoxel/aitopo test`、`typecheck`、notices spec
- [ ] commit submodule 切换；PR 注明 `git submodule update --init --recursive`

## Part 3 验收

- [ ] submodule 钉扎有效；门禁绿；无 `@neuravoxel/ai-eng` 依赖
- [ ] 合并且绿后可删 `/tmp/aitopo-vendor-backup.tgz`

## 延后（本计划不执行）

1. agent-observe 集成
2. npm 发布并退役 submodule
3. harness ↔ kit 的 K1 cherry-pick（临时、非迁移）

# 新需求从哪开始：外部贡献路径与仓库内交付流程

本文是一次过程走查（process walkthrough）：回答"一个新需求在这个仓库里怎么开始、走到合并要经过哪些关卡"，并记录其中值得注意的取舍。合同以 `CONTRIBUTING.md`、`docs/development.md`、`.github/` 下各 README 为准；这里只记观察与理由。

## 0. 最重要的结论：外部没有代码入口

`CONTRIBUTING.md:9` 明确写着现阶段**不接受外部 PR**（"we cannot accept external pull requests at the moment"）。所以"开源人员提需求"的合法路径只有两条：在 GitHub Discussions 报问题/投票，以及把需求做成 **out-of-tree 插件**（`docs/user/develop/{basic,framework,practice}/index.md`，建包五步在 `docs/cookbook/adding-a-package.md`），发布时打 `dsh-plugin` topic，用 `dsh plugin --profile <name>` 装进自己的 harness。

这条不是"流程没写完"，而是一个显式立场（`CONTRIBUTING.md:19`）：官方仓库里的包并不比社区包更重要，本仓库是"想法、官方样例、灵感来源"，不是强制规范。它和"能力缝必须是完整三角色"是同一个思路的两面——官方只保证 seam 完整，实现交给生态。

## 1. 仓库内的端到端流程

拿到协作权限后，一个新需求的实际路径是：

1. **立项**：Issue 走 `.github/ISSUE_TEMPLATE/` 三选一（bug / feature / task；Idea 与 Research 归入 task），`config.yml` 禁止 blank issue。优先级、严重度、成本、起止日期在 GitHub Project `DSH Issue Management` 里由 maintainer 手工设（[2026-09-02](../notes/implemented/process/2026-09-02-project-local-issue-planning-fields.md)）。
2. **重大需求先写 Agent Note**：起在 `.agents/notes/proposed/{class}/`，骨架含必填的 `## Alternatives considered`；机械性/局部改动豁免（`.agents/notes/README.md#when-to-write-one`）。
3. **实现**：先读 `docs/architecture.md`，按 `AGENTS.md` 的约束（挂扩展点而非改 loop、branded id、不硬编码可调项、注册即 effect）。
4. **文档三件套**：`docs/i18n/README.md` 要求 pair 是 `foo.md` + `foo.zh.md` + `foo.i18n.yaml` 三个文件，且"Pairs merge whole"——**PR 不能只落一种语言**。
5. **本地证据**：按 `.agents/skills/dsh-pre-push-checks/SKILL.md`，`change-scope` 之后挑**最窄的一条**（包行为→owning Vitest；文档→`doc-sync`；模型/CLI 可见输出→`test:snapshot`；清单导出→`build` + hygiene；真实 provider→`test:e2e`）。
6. **开 PR**：模板三段 Motivation（带 `Fixes #NN`）/ Changes / Testing（含 `<details><summary>Proof</summary>` 证据块）；标签恰好一个 `kind/*` + ≥1 `area/*` + 至多一个 `p0`–`p3`；依赖链用 GitHub 原生 stack（`gh stack link`/`sync`，`--force-with-lease`）。
7. **过门禁**：`Issue policy`（同仓库 Issue 引用、canonical kind、Priority 匹配）+ `weighted approval`（阈值 2 分，write 权限的 `CHANGES_REQUESTED` 会让它保持 pending）+ CI（PR 只跑 Python Linux x64 与 Windows x64；macOS/ARM/Wine 只在 master）。
8. **落地**：`gh stack merge --yes --merge`，并把 `proposed/` 下的 Agent Note 随同一 diff 迁到 `implemented/`。

## 2. 这套流程的几个设计取向

**约束被放在"离权威最近"的地方。** 没有明文规定"先有 Issue 才能写代码"——这层约束不写在 CONTRIBUTING 里，而是由 PR 上的 `Issue policy` 必需 job 间接强制：只有**非 draft、人类作者、已 request/submit review** 的 PR 才被评估（[2026-09-07 selective evaluation](../notes/implemented/process/2026-09-07-selective-issue-policy-evaluation.md)）。也就是说，它不打扰实验性推送，只在"这个 PR 真要进主干"时才要求可追溯。这跟"门禁只在能廉价判定时才存在"是同一条原则。

**合并权按所有权加权，而不是按人头加权。** `weighted approval` 的 1 分评审者会按 `git blame` 的生产代码占比加权到 `min(2, 1 + 4 × ownedLines / totalLines)`（[2026-09-11](../notes/implemented/process/2026-09-11-production-blame-approval-weight.md)），且阻塞性 review 让状态保持 pending 而非"分数够就放行"。效果是：改你不拥有的代码，需要拥有它的人点头。

**平台覆盖被明确地"欠债化"。** macOS ARM64/x64、Linux ARM64、Wine 只在 master 跑（[2026-09-06](../notes/implemented/process/2026-09-06-master-only-platform-ci.md)），文档直说"平台专属回归可以在 PR 全绿的情况下合入"。这是把成本显式记下来，而不是假装 PR 覆盖了所有平台。

**证据要求跟着可见性走。** 模型/协议/人类可见的改动必须带 keyless 录制会话快照；纯包行为只需 owning Vitest；文档类只需 `doc-sync`。规则不是"一律跑全套"，而是"你改变了谁所见，就拿谁的证据"，配合 `dsh-pre-push-checks` 的"never default to the full suite"。

## 3. 值得记住的缺失项（不是每条流程都被写下来）

- 没有 `CODEOWNERS`；没有 CHANGELOG，也就没有 changelog 要求。
- **没有分支命名约定**——`AGENTS.md`、`docs/development.md`、两条 stack 记录里都没有。
- CONTRIBUTING 里没有给外部贡献者写任何工作流步骤（因为入口本身是关闭的）。
- "先 Issue 后代码"只被 PR 上的 job 间接强制，未在任何面向人的文档里写明。

这几点合起来呈现出一个特征：这个仓库的规范**优先写在能被机械执行处**（workflow、verify 脚本、PR 模板、必需 status check），面向人的散文（CONTRIBUTING）反而很薄。对 agent 主导的开发这是合理的，但对第一次进来的人类贡献者，可读性是真实成本。

## 4. 待观察

- `weighted approval` 的 ownership 加权依赖 merge base 处的 `git blame`，历史重写密集（stack rebase）时的归因稳定性值得再看。
- master-only 平台 CI 与"PR 全绿即可合入"的组合，长期会不会把平台回归积压到 master，取决于发布节奏。
- 一旦外部 PR 政策开放，现在这套"薄 CONTRIBUTING + 厚 workflow"的结构需要补一层面向人的入口。

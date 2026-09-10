# 项目中如何进行 review 代码？

首次撰写：2026-09-10

> 学习笔记，非正式权威。权威入口：`.agents/skills/dsh-code-review/SKILL.md`、`docs/defensive-patterns.md`、`docs/testing.md`、`.agents/notes/implemented/process/2026-08-10-event-directed-pr-review-status.md`、`docs/cookbook/maintaining-dsh-code-review.md`。

## 一句话

**GitHub PR 上的人工评审为主；agent 用 `dsh-code-review` 对齐标准；机器门禁管可机械检查项，review 管门禁看不到的语义问题。一条有证据的 blocker 优于一堆 nits。**

## 问题

本仓库里代码怎么被 review？和 CI / 测试门禁是什么关系？agent 侧该跟哪份标准？

## 流程怎么走

1. 作者开 PR，跑过相关本地检查（`dsh-pre-push-checks`）与 CI。
2. 请求评审 → Issue Project 进入 `In review`；reviewer 提 `changes_requested` → 回到 `In progress`（event-directed PR review status）。
3. Reviewer 按 `dsh-code-review`：确认 live base/head，再跑
   `pnpm --silent run change-scope --base <base> --head <head>`，读 diff 与周边设计。
4. 优先正确性、生命周期、安全、被破坏的必需行为。
5. 发现写在最贴 diff 的 inline 评论；跨切割问题写 PR 级评论；区分 blocker / suggestion；门禁已拦住的不要再提。
6. 收评论方：按技术点修或反驳，不做表演性同意。

## Review 查什么（门禁之外）

### Blocking（skill 要求）

- 新增/改动的 prose（Markdown、JSDoc、prompt、可见文案）做语义审查（`dsh-prose-standard`）
- 文档与代码同 diff 更新；核心类型进 subsystems / `type-equiv`
- 注册会清理；`./invariant` 语义正确（有独立可观察关系，非空 installer）
- 作者有相关本地证据，CI 覆盖全矩阵
- Client UI 文案走 locale（`verify-client-ui-i18n`），拒绝硬编码产品文案

### Manual（代表性）

| 维度 | 看什么 |
|---|---|
| 契约 | 接口两侧、错误/取消/所有权/disposal |
| 生命周期 | 异步 setup、callback、subprocess、teardown（`defensive-patterns.md`） |
| 能力 seam | consumer 特化是否泄漏进通用接口；或无谓扩公共 API |
| 模型视角 | prompt / tool schema / 诊断是否越出模型任务 |
| 真实入口 | Loader / bin / worker / ACP，而非手挂 plugin |
| 测试强度 | 是否验证外部世界、能否抓住目标回归 |
| 可见输出 | snapshot / expected 是否更新；双语是否真同义 |
| Agent Note | proposed → implemented 时是否改成现在时并与实现一致 |

## 和测试 / 门禁的关系

| 层 | 作用 |
|---|---|
| Quality gates（typecheck、lint、coverage、doc-sync…） | 机械可证；agent 更守门禁而非散文约定 |
| 相关测试 / snapshot / e2e | 行为证据 |
| **Human review + `dsh-code-review`** | 设计意图、生命周期、模型可见性、文档语义、测试是否「够硬」 |

门禁绿 ≠ review 通过；review 通过也不替代该跑的测试。

## 反馈如何回流到标准

已采纳的**人工**评审意见，经私有周期维护工具沉淀进 `dsh-code-review` skill（见 `maintaining-dsh-code-review` cookbook）。

- 学习源是 human-authored、且落地代码采纳的反馈，不是 bot 发现
- 「thread resolved」或作者说 fixed ≠ 采纳证据
- 候选 skill 变更仍走普通仓库 PR review 才进 `master`

## 本地 / agent 侧怎么用

| 场景 | 跟什么 |
|---|---|
| 评审本仓库 PR | `.agents/skills/dsh-code-review/SKILL.md` |
| 收 review 评论 | 按技术点修或反驳 |
| Bugbot / Security Review（Cursor） | 可选辅助，需显式调用；**不替代** `dsh-code-review` + 人工 PR review |

## 易混点

| 说法 | 实际含义 |
|---|---|
| CI 全绿 | 机械门禁通过，不是语义 review 完成 |
| `change-scope` | 标出路径与脏层，**不替代**语义阅读 |
| Agent Note 与实现不一致 | 当设计讨论，不是自动否决 |
| 翻译配对 hash 绿 | 不证明译文质量；双语变更仍要人工比义 |
| Bugbot 评论 | 辅助信号；skill 维护只学已采纳的人工反馈 |

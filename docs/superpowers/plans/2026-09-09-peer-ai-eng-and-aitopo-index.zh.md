# Peer AI eng kit + aitopo — 计划索引

[English](2026-09-09-peer-ai-eng-and-aitopo-index.md) | 中文

> **给 agentic worker：** 按顺序执行三份链接计划。每份可独立交付。Part N 验收通过前不要开始 N+1。实现时使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。

**规格：** [.agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md](../../.agents/notes/implemented/architecture/2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md)

**Peers（无父子权威，仅 K1 cherry-pick）：**

| 顺序 | 计划 | 仓库 | 结果 |
|---|---|---|---|
| 1 | [2026-09-09-ai-eng-kit-mvp.zh.md](./2026-09-09-ai-eng-kit-mvp.zh.md) | `NeuraVoxel/ai-eng-kit` | 可安装 `@neuravoxel/ai-eng`：`init` + notes 门禁 + 可移植 skills + 测试政策文档 |
| 2 | [2026-09-09-aitopo-peer-repo-standup.zh.md](./2026-09-09-aitopo-peer-repo-standup.zh.md) | `NeuraVoxel/aitopo` | 引擎可独立 build/test；接入 kit；CI 绿 |
| 3 | [2026-09-09-harness-aitopo-submodule.zh.md](./2026-09-09-harness-aitopo-submodule.zh.md) | `deepseek-harness` | `vendor/aitopo` → submodule 钉扎；更新 notices/README/Agent Notes |

**明确不在这三份计划内（另开 follow-up）：**

- `plugins/agent-observe` 的 AITopoHost 集成
- 发布 `@neuravoxel/aitopo` npm 并退役 submodule
- 让 deepseek-harness 依赖 `ai-eng-kit`（K1 下禁止）

**执行时工作目录：**

```text
~/src/ai-eng-kit
~/src/aitopo
<本仓>  # deepseek-harness
```

除 Part 3 的 submodule 切换外，不要在 harness 树内实现 kit 或 aitopo 引擎。

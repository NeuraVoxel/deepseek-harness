# agent-orchestrator

[English](README.md) | 中文

可选插件：Harness **编排框架**（F0 = 只读）。以 Orchestration Document 为权威，经 [@neuravoxel/aitopo](../../vendor/aitopo) 投影；Client 通过 `remote.pluginInventory.list` 拉取 preset 组合行。

- 设计稿：[docs/2026-09-08-agent-orchestrator-design.md](./docs/2026-09-08-agent-orchestrator-design.md)
- F0 计划：[docs/2026-09-08-agent-orchestrator-f0-plan.md](./docs/2026-09-08-agent-orchestrator-f0-plan.md)
- AITopo Editor 需求：[vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md](../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md)
- 与 [agent-observe](../agent-observe/README.zh.md) 并列：观察 Tab 展示运行态拓扑；本插件投影组合。

## 怎么跑

```sh
pnpm install
pnpm --filter dsh-agent-orchestrator bundle
pnpm dsh web --patch ./plugins/agent-orchestrator/cordis.patch.yml
```

打开任意 Session → **编排** Tab，选择 preset 查看组合行（只读）。

或装进 profile：

```sh
pnpm --filter dsh-agent-orchestrator bundle
pnpm dsh plugin --profile web-orchestrator-demo add ./plugins/agent-orchestrator
pnpm dsh --profile web-orchestrator-demo
```

## 目录

| 路径 | 作用 |
|---|---|
| `src/index.ts` | Host `ctx.agentOrchestrator` |
| `src/types.ts` / `from-preset.ts` / `to-graph.ts` | 文档与适配 |
| `src/client/` | 对话 Tab + AITopoHost |

## 已知限制与延后工作

- F0 只读；编辑等待 AITopo Editor（AT-E*）。
- 尚无专用 orchestrator Typert Remote；Client 走 plugin-inventory。
- Commit / 写回 preset 属 F1。

## 模型体验

无面向模型的文案或工具。

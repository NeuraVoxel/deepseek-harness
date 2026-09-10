# agent-orchestrator

[English](README.md) | 中文

可选插件：Harness **编排框架**（F1 画布编辑已开；CommitSink 延后）。以 Orchestration Document 为权威，经 [@neuravoxel/aitopo](../../vendor/aitopo) 投影；Client 通过 `remote.pluginInventory.list` 拉取 preset 组合行。

- 设计稿：[docs/2026-09-08-agent-orchestrator-design.md](./docs/2026-09-08-agent-orchestrator-design.md)
- F0 计划：[docs/2026-09-08-agent-orchestrator-f0-plan.md](./docs/2026-09-08-agent-orchestrator-f0-plan.md)
- AITopo Editor 需求：[vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md](../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md)
- Wave D（F1 chrome）：[vendor/aitopo/docs/2026-09-10-aitopo-wave-d-orchestrator-f1-chrome.md](../../vendor/aitopo/docs/2026-09-10-aitopo-wave-d-orchestrator-f1-chrome.md)
- 与 [agent-observe](../agent-observe/README.zh.md) 并列：观察 Tab 展示运行态拓扑；本插件投影组合。

## 怎么跑

```sh
pnpm install
pnpm --filter dsh-agent-orchestrator bundle
pnpm dsh web --patch ./plugins/agent-orchestrator/cordis.patch.yml
```

打开任意 Session → **编排** Tab，选择 preset 查看组合行。可拖动未锁定节点（用户 Preset）；系统 Preset 行保持锁定。Shift+空地框选；四角手柄可缩放（仅会话绘制）。撤销/重做走 AITopo `PatchHistory`。布局改动**仅本会话**，待 CommitSink / 写回 Preset。画布按 [wiki/011 九层](../../wiki/011-插件分组与主要作用.md) 分带显示（仅展示有成员的层），**① 底层在下**、上层靠上。工具栏显示当前 Preset 完整 inventory 文档上的 **本 Preset** / **宿主已加载** 数量（不受画布 checkbox 影响）。默认只画 **本 Preset**；勾选 **显示宿主已加载** 后，才会把 Host Loader 已加载但不在该 Preset 组合里的插件以淡色节点画在同一分带中（实心 = Preset · 淡色 = 仅 Host；两边都有的只保留一个实心节点）。checkbox 状态仅在本 Tab 挂载内有效。当查看**当前会话**正在用的 Preset 且 turn 执行中时，会按 Session 日志证据高亮对应 **composition** 插件：`tool/call` 名称，以及压缩、审批、hooks 等经静态 event→module 映射的非工具事件；无日志证据的 spine 插件保持暗色（observe 仍负责业务 flow / 数据流）。点击插件节点可查看归属、条目 ID、模块、架构层、包组、启用状态、条件、Fiber 阶段与锁定。`conversation.chat.assistant-actions`（与 Turn usage 同行）上的 28px 图标也可打开本 Tab；按 Turn 灌数延后。

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
| `src/types.ts` / `from-preset.ts` / `from-inventory.ts` / `to-graph.ts` | 文档与适配 |
| `src/architectural-layer.ts` / `npm-package-group.ts` | wiki/011 分层解析（npm → 包组 → 层） |
| `src/map-tool-activity.ts` | 运行中 tool → 组合单元高亮 |
| `src/participation-map.ts` | Session 事件类型 → 模块 → 组合单元高亮 |
| `src/document-for-canvas.ts` | 可选省略 Host catalog 再投影画布 |
| `src/session-layout.ts` | F1 chrome 会话布局合并 |
| `src/client/` | 对话 Tab + Turn 尾栏快捷图标 + AITopoHost + Session 活动源 |

## 已知限制与延后工作

- F1 chrome 已开（移动 / 框选 / 缩放 / 撤销）；CommitSink / 写回 Preset 仍延后。
- 尚无专用 orchestrator Typert Remote；Client 走 plugin-inventory。
- catalog↔composition 归属不通过层 drop-target 编辑。

## 模型体验

无面向模型的文案或工具。

# Agent Note: AITopo 编辑交互（移动、投放、框选、PatchHistory）

Status: proposed

[English](2026-09-09-aitopo-editor-interactions.md) | 中文

## Problem

第一期 `@neuravoxel/aitopo` 仅达观察级（平移/缩放、选中/激活、load/apply）。`dsh-agent-orchestrator` F1 需要由画布手势驱动图变更——节点移动、目录投放、组合归属、框选，以及可逆 patch——且引擎内不得引入 React、Cordis 或 harness 类型，也不得复制 `vendor/SDK2D` / twaver API。

## Proposal

在既有双面 Network / Interaction 表面上交付 Editor 里程碑：

1. 专用 `GraphEvent` 判别式：`nodeMoved`、`groupMembershipChanged`、`externalDrop`（不只依赖 `documentChanged` 元数据）。
2. 可选协议级 `PatchHistory`（正向/逆向 `GraphPatch` 对）；宿主可忽略并自管栈。
3. 框选为 **Shift+空白拖拽**；未修饰的空白拖拽仍为平移。
4. 一等字段 `GraphNode.locked` 与 `GraphGroup.style`（组合带可用 `strokeDash`）。
5. 仅参考 `twaver.vector` 思想做干净室实现（实时移动、可移动门闩、框选叠加、组合描边、UndoManager → patch）——不导入 SDK2D，不使用 twaver 公开命名。
6. 自由画布 `externalDrop`：引擎发出场景坐标 `{ x, y }` 与不透明 MIME 载荷；由**宿主**决定 `addNode` / 归属。

需求：[vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md](../../../../vendor/aitopo/docs/2026-09-08-aitopo-editor-requirements.md)。计划：[vendor/aitopo/docs/2026-09-09-aitopo-editor-implementation-plan.md](../../../../vendor/aitopo/docs/2026-09-09-aitopo-editor-implementation-plan.md)。相关：[双面 Canvas 引擎](2026-09-07-aitopo-dual-face-canvas-engine.zh.md)。

## Alternatives considered

- **编辑只发 `documentChanged`。** 拒绝：编排宿主需要结构化的移动/投放/归属载荷，而不必对整份文档重做 diff。
- **投放时引擎自动 `addNode`。** 拒绝：目录语义属于宿主；引擎保持载荷不透明（先 `text/plain`，空则 `application/aitopo-drop`）。
- **镜像 twaver `UndoManager` 属性监听。** 拒绝：历史单位是 `GraphPatch`，以便模型与宿主共用同一栈词汇。
- **用 P 键和弦做组合重挂（twaver）。** 拒绝：Editor 约定在移动结束时按组合命中自动改归属，以服务编排器的拖入组合带。
- **单独的 `setEditInteractions` 命名 API。** 拒绝：通过 `Network({ interactions: […] })` 追加到默认交互即可。

## Acceptance criteria

- 单测覆盖 AT-E1–E6 与 AT-E8；fixture `editor.json` 可解析。
- Demo **Editor** 模式在默认交互之外挂上 Move / ExternalDrop / Marquee；观察用 Fleet/Flow/Teams 重挂时不带编辑交互。
- 状态行展示 `nodeMoved` / `externalDrop` / `groupMembershipChanged`；投放桩由宿主 `addNode`；Undo/Redo 走 `PatchHistory`。
- 引擎包无 React、Cordis、`@deepseek-ai/dsh-*`；`vendor/aitopo/src` 无 `twaver` / `SDK2D` 导入。

## Risks

- 手势组合（移动 vs 选择 vs 平移 vs Shift 框选）若挂载顺序或阈值漂移可能互抢；用文档化的 Shift 框选与 4px 拖拽阈值缓解。
- Demo 为撤销而包装 `apply` 可能让同时订阅每次 apply 的宿主意外；生产宿主应显式构造 `PatchHistory`，而非猴子补丁。
- 编排器仍需在后续把 `unit.locked` 映射到 `GraphNode.locked`；仅有引擎 `locked` 不会接通插件。

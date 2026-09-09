# Agent Note: 在 vendor/aitopo 下的 AITopo 双面 Canvas 引擎

Status: proposed

[English](2026-09-07-aitopo-dual-face-canvas-engine.md) | 中文

## Problem

`plugins/agent-observe` 用手工 SVG 渲染 Session / Agent 拓扑。该路径难以扩展为人类与模型共用的图形库，也缺少 Agent Teams 下钻与工作流告警的干净接法。`vendor/SDK2D`（twaver）虽有成熟的 vector Network，但复制其源码或公开 API 在授权与所有权上不可接受。

## Proposal

将 `@neuravoxel/aitopo` 作为 `vendor/aitopo` 下的第一方 TypeScript 包交付（不是 Cordis 上游 pin）：

1. 双面架构：对 AI / 插件暴露 Document / Patch / Events；内部为 Scene + View + Renderer。
2. 干净室重写 twaver.vector 思想（双 canvas、脏校验、交互插件），使用新命名与 API；零 SDK2D 导入。
3. 第一期即按 dirty-rect 绘制；相机或尺寸变化时全帧失效。
4. 第一期引擎包含 Alarm 角标与单层 SubNetwork。
5. 先交付引擎与 vanilla DOM demo，再集成 `plugins/agent-observe`。
6. Canvas 2D 实现放在可替换的 `Renderer` 接口之后（预留 WebGL）；引擎包不含 React。

设计：[vendor/aitopo/docs/2026-09-07-aitopo-design.md](../../../../vendor/aitopo/docs/2026-09-07-aitopo-design.md)。计划：[vendor/aitopo/docs/2026-09-07-aitopo-implementation-plan.md](../../../../vendor/aitopo/docs/2026-09-07-aitopo-implementation-plan.md)。插件集成：[vendor/aitopo/docs/2026-09-07-aitopo-agent-observe-integration.md](../../../../vendor/aitopo/docs/2026-09-07-aitopo-agent-observe-integration.md)。

## Alternatives considered

- 仅 Document-first（无 Scene/View）：对 Agent 友好，弱于脏区绘制与交互。
- 仅 Scene-first（类 twaver Element 作为公开 API）：不利于模型驱动的 patch。
- 仓外独立仓库：原先改为 `vendor/aitopo` 以便 monorepo workspace 接线；所有权由 peer 仓提案 [2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md](2026-09-09-ai-eng-kit-and-aitopo-peer-repos.zh.md) 取代（先 submodule，后 npm）。Dual-face 协议与引擎纯净性不变。
- 直接移植或包装 twaver：因干净室与授权清晰性而拒绝。

## Acceptance criteria

- `@neuravoxel/aitopo` 包测试通过；包项目 typecheck 通过。
- Demo 可加载 fleet / flow / teams；patch、alarm、SubNetwork 进入/退出可用。
- 引擎包无 React、Cordis、`@deepseek-ai/dsh-*` 依赖。
- 无 `vendor/SDK2D` 导入。
- `vendor/README.md` 写明第一方例外。
- `plugins/agent-observe` 仅通过 `AITopoHost` 渲染 Fleet / Flow（无 SVG 舞台 / feature flag）。

## Risks

- Dirty-rect 裁剪错误可能导致花屏；用 `debugPaintRects` 与全帧回退缓解。
- `vendor/` 布局易与 Cordis pin 混淆；用 README 归属说明并排除 sync 流程。
- Document 与 Scene 双源可能漂移；用单一写路径（`load` / `apply` / layout / enter-exit）约束。

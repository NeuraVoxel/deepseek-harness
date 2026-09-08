# agent-orchestrator：有证据的本回合参与高亮

[English](2026-09-08-orchestrator-evidence-participation-highlight-design.md) | 中文

**状态：** 已批准设计（2026-09-08）

**范围：** 仅 `plugins/agent-orchestrator`。扩展 Client 侧 Session 事件折叠。无新 Session 事件类型、无 Host Remote、无 Loader/Fiber 轮询、不改 agent-loop。

**相关：** 画布 Host catalog（[2026-09-08-orchestrator-host-catalog-on-canvas-design.md](./2026-09-08-orchestrator-host-catalog-on-canvas-design.zh.md)）；现有工具名路径见 `map-tool-activity.ts` / `derive-activity.ts`。

## 产品

Session 在跑且编排画布显示该会话 Preset 时，点亮本回合 **Session 日志有证据** 参与过的每一个 **composition** 单元——不是仅 Fiber `active`（已挂载），也不是仅 Host 的 `catalog` 节点。

证据指：`tool/call`（或 assistant 内嵌 tool-call）中的工具名，或类型可映射到已知包的、经筛选的非工具本回合事件。

每个 step 都在干活但没有独立 Session 事件的插件（system-prompt 组装、agent-loop、LLM 适配器、多数 guard）保持不亮。完整 Cordis 参与溯源需改核心源码，不在本范围。

## 信号

沿用 `deriveCompositionActivity` 的 turn 作用域（`turn/start` seq 窗口、`session.running`）。

| 信号 | 如何落到单元 |
|---|---|
| `tool/call` / assistant `tool-call` 名（进行中 + 本回合） | 工具名 → 模块 / 入口 leaf（现有别名；成本可控时对齐 tool-catalog） |
| 同一 turn 窗口内经筛选的事件类型 | 静态 `event.type` → 模块名 |

初始非工具事件表（有缺口再扩；未知类型忽略）：

| 事件前缀 / 类型 | 目标模块提示 |
|---|---|
| `compaction/*` | `@deepseek-ai/dsh-compaction`（组合里若有独立 provider 包则一并匹配） |
| `approval/*` | `@deepseek-ai/dsh-user-approval` |
| `hook/invoked`, `hook/result` | 组合中的 hook 桥接包（按模块后缀 / 已知 id） |
| `command/run`, `command/done` | `@deepseek-ai/dsh-commands` |
| `llm/retry`, `llm/retry-started` | `@deepseek-ai/dsh-llm-retry` |
| `plan/mode` | `@deepseek-ai/dsh-plan-mode` |
| `todo/write` | `@deepseek-ai/dsh-tool-todo`（有 tool/call 时也会被工具路径覆盖） |

单元解析：将映射出的模块名（及工具别名）与 **composition** 单元的 `moduleName` / entry leaf 匹配——与 `unitIdsForToolName` 同风格。对不上的提示丢弃。

## 高亮规则

门槛不变：

- 仅当查看的 Preset 为会话 `agentPreset`（或 preset 未知）且 `session.running`。
- **仅 composition**——永不 catalog。
- 进行中工具 → 强 live；本回合已结束工具与非工具事件命中 → turn 样式。

合并集合：`liveUnitIds(tools) ∪ unitIdsForModules(eventModules)`。

## 非目标

- 把 Fiber `active` 当参与。
- 新 Session 事件 / Host 参与 Remote（完整溯源）。
- 无日志证据时点亮沉默脊柱插件。
- 编辑 / AITopo Editor。

## 测试

插件 vitest：

- 最新 turn 内的 compaction / approval / command（及同类）事件点亮对应 composition 单元。
- 未知事件类型不点亮。
- 现有 tool→unit 映射不回退；catalog 保持不亮；非会话 Preset 保持不亮。

## 文档

- README：参与高亮以 Session 日志证据为准。
- Agent Note：本切口为何选 A（事件证据）而非 Fiber 轮询或完整溯源。

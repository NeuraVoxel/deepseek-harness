# agent-orchestrator：同一 Preset 画布上的 Host catalog

[English](2026-09-08-orchestrator-host-catalog-on-canvas-design.md) | 中文

**状态：** 已批准设计（2026-09-08）

**范围：** 仅 `plugins/agent-orchestrator`。复用 `pluginInventory/list`（`entries` + `agentPresets`）。无新 Remote、无 AITopo 编辑改动、不按 wiki/011 罗列仓库未挂载包。

**相关：** [agent-orchestrator 设计](../../../plugins/agent-orchestrator/docs/2026-09-08-agent-orchestrator-design.md)（已预留 `catalog[]`）；[wiki/011](../../../wiki/011-插件分组与主要作用.md)（仅作分层分带）。

## 产品

每个 Preset 页展示并集：

1. **本 Preset 的组合行**（Agent 平面）。
2. **当前已加载的 Host Loader 插件**中，尚未出现在该组合里的项。

两套集合画在同一画布上，仍按 wiki/011 架构层分带。样式区分归属：实心 = 本 Preset；淡色/虚线 = 仅 Host。

若某插件同时出现在 Loader 与本 Preset，只保留 **一个** 节点，归属 composition（Preset 优先）。

## Inventory（数据源）

`pluginInventory/list` 是 Host 调用当下的只读快照：

| 字段 | 含义 |
|---|---|
| `entries` | Cordis Loader 非组插件（Host 平面） |
| `agentPresets[].rows` | 各 preset 压平后的组合行（Agent 平面） |

本功能的「全量已加载」取 **A**：`entries ∪ 本 Preset 的 rows`，不是 monorepo 全包，也不是所有 Preset 的并集。

## 文档拼装

由选中的 preset 组与 `entries` 构建 `OrchestrationDocument`：

| 字段 | 内容 |
|---|---|
| `composition` | 选中 Preset 的 rows（沿用 `fromPresetComposition` / 共享 unit 辅助） |
| `catalog` | 与任何 composition 单元都 **对不上** 的 Loader `entries` |

**去重键：** 两侧都有非空 `entryId` 时优先用 id，否则用 `moduleName`。匹配到的 Loader 行只从 `catalog` 排除。

catalog 单元同样按 `moduleName` 解析 wiki/011 的 `layer` / `packageGroup`，并带上 Loader 的 `enabled` / `fiberPhase`。F1 前将 catalog 视为不可编辑（`locked: true` 或等价的图 `data` 标记）。

**本切口数据路径：** Client 继续调用 `remote.pluginInventory.list()`，再 `fromInventory(preset, entries)`（新建于 `from-preset` 旁）。Host `agentOrchestrator.document()` 可暂仍只含 preset；F0 展示不要求新 Typert 方法。

## 画布投影

`toGraphDocument` 对 **`composition ∪ catalog`** 做 `layoutByArchitecturalLayer`：

- 层内：先 composition（inventory 顺序），再 catalog（Loader 顺序）。
- 空层不画。
- 空态：两边都空 → 现有 empty；仅 catalog 非空 → 画仅 Host 分带（不当 empty/broken）。

**绘制**

| 归属 | 外观 |
|---|---|
| `composition` | 现有 enablement / live 调色 |
| `catalog` | 更低对比 fill、更弱或虚线 stroke、更安静的标签；副标题 `host` / 「仅宿主」 |

详情面板对 `catalog` 节点标明仅 Host。工具条 hint：实心 = 本 Preset · 淡色 = 宿主已加载。

## Live 高亮

门槛不变：仅当查看的 Preset 为会话 `agentPreset`（或 preset 未知）且会话在跑时启用。tool→unit 映射与高亮 **只作用于 `composition`**。catalog 节点永不接受 tool live 高亮。

## 非目标

- 从 catalog 拖入 composition 的编辑（F1 + AITopo Editor）。
- 展示 wiki/011 中未加载的 monorepo 包。
- 跨所有 Preset 的并集。
- 改动 `dsh-host-plugin-inventory` 合同。

## 测试

插件 vitest：

- 按 `entryId` / `moduleName` 去重；重叠只留在 `composition`。
- `to-graph` 含 catalog 样式与混层布局；仅 catalog 非空时仍出画布。
- live 活动忽略 catalog 的 unit id。

## 文档

- 更新 `plugins/agent-orchestrator` README 双语：Preset 画布在组合旁以淡色显示 Host 已加载但未入本 Preset 的插件。
- 同 PR Agent Note：为何复用预留的 `catalog[]` 上画布，而不是在单一 composition 数组上加 `membership` 字段。

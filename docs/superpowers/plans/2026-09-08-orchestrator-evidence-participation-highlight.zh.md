# 有证据的编排参与高亮 — 实现计划

[English](2026-09-08-orchestrator-evidence-participation-highlight.md) | 中文

> **给 Claude：** REQUIRED SUB-SKILL: 用 superpowers:executing-plans 按任务实现本计划。

**目标：** Session 在跑且编排 Tab 显示该会话 Preset 时，点亮最新 turn 上有 Session 日志证据的每一个 composition 单元（工具 + 经筛选的非工具事件），而非 Fiber 挂载状态。

**架构：** 仅扩展 `plugins/agent-orchestrator` 的 Client 折叠。`deriveCompositionActivity` 从事件类型收集 turn 作用域的模块提示；`map-tool-activity`（或旁路模块）将模块映射到 composition unit id，并与现有 tool→unit live 集合合并。规格：[`../specs/2026-09-08-orchestrator-evidence-participation-highlight-design.zh.md`](../specs/2026-09-08-orchestrator-evidence-participation-highlight-design.zh.md)。

**技术栈：** TypeScript、vitest、现有 Session 事件窗类型。

---

### 任务 1：事件类型 → 模块映射 + 单元解析

**文件：**
- 新建：`plugins/agent-orchestrator/src/participation-map.ts`
- 新建：`plugins/agent-orchestrator/src/participation-map.spec.ts`
- 修改：`plugins/agent-orchestrator/src/index.ts`（按需再导出）

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { modulesForEventType, unitIdsForModules } from './participation-map.ts'
import { fromPresetComposition } from './from-preset.ts'
import type { PresetCompositionInput } from './types.ts'

const preset: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  isDefault: true,
  rows: [
    { entryId: 'compaction', moduleName: '@deepseek-ai/dsh-compaction', enabled: true },
    { entryId: 'tool-bash', moduleName: '@deepseek-ai/dsh-tool-bash', enabled: true },
  ],
}

describe('modulesForEventType', () => {
  it('maps compaction and approval events; ignores unknown types', () => {
    expect(modulesForEventType('compaction/start')).toContain('@deepseek-ai/dsh-compaction')
    expect(modulesForEventType('approval/asked')).toContain('@deepseek-ai/dsh-user-approval')
    expect(modulesForEventType('turn/start')).toEqual([])
  })
})

describe('unitIdsForModules', () => {
  it('resolves composition units by moduleName', () => {
    const units = fromPresetComposition(preset).composition
    const ids = unitIdsForModules(units, ['@deepseek-ai/dsh-compaction'])
    expect(ids.has('standard:compaction')).toBe(true)
    expect(ids.has('standard:tool-bash')).toBe(false)
  })
})
```

**步骤 2：跑测试确认失败**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/participation-map.spec.ts
```

**步骤 3：实现** `EVENT_TYPE_TO_MODULES`（精确类型 + `compaction/*` 等前缀）、`modulesForEventType`、`unitIdsForModules`（规范化 / 去掉 `@deepseek-ai/dsh-` leaf，与 tools 一致）。

**步骤 4：通过并提交**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/participation-map.spec.ts
git add plugins/agent-orchestrator/src/participation-map.ts plugins/agent-orchestrator/src/participation-map.spec.ts plugins/agent-orchestrator/src/index.ts
git commit -m "$(cat <<'EOF'
Add Session event to composition module participation map.

EOF
)"
```

---

### 任务 2：在 `deriveCompositionActivity` 中折叠参与模块

**文件：**
- 修改：`plugins/agent-orchestrator/src/client/derive-activity.ts`
- 修改：`plugins/agent-orchestrator/src/activity.spec.ts`

**步骤 1：扩展 `CompositionActivity`**

```ts
readonly turnModuleNames: readonly string[]
```

未 running 时为空。对 `seq >= latestTurnStartSeq` 的事件经 `modulesForEventType` 填充并去重。

**步骤 2：测试**

```ts
it('collects turnModuleNames from compaction events on the latest turn', () => {
  const events = {
    entries: [
      { type: 'event', event: { type: 'turn/start', seq: 1, time: 1, data: { turn: 1 } } },
      { type: 'event', event: { type: 'compaction/start', seq: 2, time: 2, data: {} } },
    ],
    hasMore: false,
  } as never
  const activity = deriveCompositionActivity(events, { running: true } as never, 'standard')
  expect(activity.turnModuleNames).toContain('@deepseek-ai/dsh-compaction')
})
```

fixture 的 `data` 形状按真实 `SessionEvent` 尽量对齐（可与现有测试一样 cast）。

**步骤 3：更新 `emptyCompositionActivity` / EMPTY。**

**步骤 4：提交**

```sh
git add plugins/agent-orchestrator/src/client/derive-activity.ts plugins/agent-orchestrator/src/activity.spec.ts
git commit -m "$(cat <<'EOF'
Derive turn module participation from Session events.

EOF
)"
```

---

### 任务 3：把模块命中并入 live 绘制

**文件：**
- 修改：`plugins/agent-orchestrator/src/client/OrchestratorView.tsx`
- 修改：`plugins/agent-orchestrator/src/activity.spec.ts`（或 adapters；若抽出合并辅助）

**步骤 1：** 计算 live id 时：

```ts
const runningIds = liveUnitIds(orchestrationDoc.composition, activity.runningToolNames)
const turnToolIds = liveUnitIds(orchestrationDoc.composition, activity.turnToolNames)
const turnModuleIds = unitIdsForModules(orchestrationDoc.composition, activity.turnModuleNames)
const turnIds = new Set([...turnToolIds, ...turnModuleIds])
```

照旧传入 `withLiveActivity`。详情面板的 live 对 composition 单元也应计入模块命中。

**步骤 2：** 测：composition 含 compaction 单元且 `turnModuleNames` 含该模块时，得到 turn paint（对合并 + `withLiveActivity` 做单元测试，不必上完整 React）。

**步骤 3：提交**

```sh
git add plugins/agent-orchestrator/src/client/OrchestratorView.tsx plugins/agent-orchestrator/src/activity.spec.ts
git commit -m "$(cat <<'EOF'
Light composition units from turn event module participation.

EOF
)"
```

---

### 任务 4：轻度扩展工具别名（可选同 PR）

若标准 Preset 常见工具仍有明显缺口，仅补 `TOOL_ALIASES`——本切口**不**阻塞完整 gen-tool-catalog 接线（规格允许延后）。

---

### 任务 5：README + Agent Note

**文件：**
- 修改：`plugins/agent-orchestrator/README.md` + `.zh.md`
- 新建：`.agents/notes/implemented/feature/2026-09-08-orchestrator-evidence-participation-highlight.md`（+ zh / i18n）

写明：live 高亮以 Session 日志证据为准（工具 + 经筛选事件）；沉默脊柱插件不亮；完整溯源需改核心。

```sh
pnpm run verify-translation-pairing --write plugins/agent-orchestrator/README.md
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/2026-09-08-orchestrator-evidence-participation-highlight.md
git add …
git commit -m "$(cat <<'EOF'
Document evidence-based orchestrator participation highlight behavior.

EOF
)"
```

---

### 任务 6：最终校验

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run
pnpm --filter dsh-agent-orchestrator bundle
```

---

## 非范围

- 把 Fiber `active` 当参与
- 新 Session 事件 / Host Remote
- 引入生成的 tool-catalog（可选后续）
- 点亮 catalog / 非会话 Preset

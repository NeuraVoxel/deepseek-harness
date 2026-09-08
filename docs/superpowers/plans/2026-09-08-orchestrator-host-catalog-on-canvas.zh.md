# Host catalog 上 agent-orchestrator Preset 画布 — 实现计划

[English](2026-09-08-orchestrator-host-catalog-on-canvas.md) | 中文

> **给 Claude：** REQUIRED SUB-SKILL: 用 superpowers:executing-plans 按任务实现本计划。

**目标：** 每个 Preset 页在 wiki/011 分带上同时展示本 Preset 组合与 Host Loader 已加载插件；本 Preset 实心、仅 Host 淡色；重叠合并为一个 composition 节点。

**架构：** 改动仅限 `plugins/agent-orchestrator`。复用 `pluginInventory/list`（`entries` + `agentPresets`）。用对不上本 Preset 组合的 Loader 行填满预留的 `catalog[]`；`toGraphDocument` 投影 `composition ∪ catalog`。Client 经新 `fromInventory` 建文档（无新 Remote）。Live tool 高亮仍只扫 `composition`。规格：[`../specs/2026-09-08-orchestrator-host-catalog-on-canvas-design.zh.md`](../specs/2026-09-08-orchestrator-host-catalog-on-canvas-design.zh.md)。

**技术栈：** TypeScript、vitest、React（OrchestratorView + locales）、AITopo 经 `node.data` 上色。

---

### 任务 1：`fromInventory` — composition + Host catalog 去重

**文件：**
- 新建：`plugins/agent-orchestrator/src/from-inventory.ts`
- 修改：`plugins/agent-orchestrator/src/from-preset.ts`（按需导出共享 row→unit 辅助；Host 调用方仍可用 `fromPresetComposition`）
- 修改：`plugins/agent-orchestrator/src/adapters.spec.ts`（或新建 `from-inventory.spec.ts`）
- 修改：`plugins/agent-orchestrator/src/index.ts`（若需再导出）

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { fromInventory } from './from-inventory.ts'
import type { PresetCompositionInput } from './types.ts'

const preset: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  name: 'Standard',
  isDefault: true,
  rows: [
    { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true, fiberPhase: 'active' },
  ],
}

describe('fromInventory', () => {
  it('puts unmatched Loader entries in catalog and locks them', () => {
    const doc = fromInventory(preset, [
      { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true, fiberPhase: 'active' },
      { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
    ])
    expect(doc.composition).toHaveLength(1)
    expect(doc.composition[0]?.id).toBe('standard:persona')
    expect(doc.catalog).toHaveLength(1)
    expect(doc.catalog[0]).toMatchObject({
      entryId: 'host-ui',
      moduleName: '@deepseek-ai/dsh-client',
      locked: true,
      label: 'host-ui',
    })
    expect(doc.catalog[0]?.id.startsWith('host:')).toBe(true)
  })

  it('dedupes by moduleName when entryId is null on the preset row', () => {
    const doc = fromInventory({
      ...preset,
      rows: [{ entryId: null, moduleName: '@deepseek-ai/dsh-tool-bash', enabled: true }],
    }, [
      { entryId: 'bash', moduleName: '@deepseek-ai/dsh-tool-bash', enabled: true, fiberPhase: 'active' },
    ])
    expect(doc.composition).toHaveLength(1)
    expect(doc.catalog).toEqual([])
  })
})
```

**步骤 2：跑测试确认失败**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/from-inventory.spec.ts
```

期望：FAIL — 模块缺失或 `fromInventory` 未定义。

**步骤 3：实现**

- `matchesComposition(unit, entry)`：两侧都有非空 `entryId` 则比 id，否则比 `moduleName`。
- `fromInventory(preset, entries)`：
  1. `const base = fromPresetComposition(preset)`
  2. 对每个 Loader entry，若已匹配任一 composition 单元则跳过；否则写入 catalog，`id = host:${entryId}`，`locked: true`，layer 来自 `resolveArchitecturalLayer(moduleName)`，`fiberPhase` 来自 entry。
- `fromPresetComposition` 仍返回 `catalog: []`，直至 Host `document()` 自行接入。

**步骤 4：跑测试确认通过**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/from-inventory.spec.ts
```

期望：PASS。

**步骤 5：提交**

```sh
git add plugins/agent-orchestrator/src/from-inventory.ts plugins/agent-orchestrator/src/from-inventory.spec.ts plugins/agent-orchestrator/src/from-preset.ts plugins/agent-orchestrator/src/index.ts plugins/agent-orchestrator/src/adapters.spec.ts
git commit -m "$(cat <<'EOF'
Add fromInventory to fill orchestrator catalog from Loader entries.

EOF
)"
```

---

### 任务 2：`toGraphDocument` — 并集布局 + catalog 样式 + 空态

**文件：**
- 修改：`plugins/agent-orchestrator/src/to-graph.ts`
- 修改：`plugins/agent-orchestrator/src/adapters.spec.ts`

**步骤 1：写失败测试**

```ts
it('lays out catalog units in the same layer bands with host paint', () => {
  const doc = fromInventory(sample, [
    { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
  ])
  const graph = toGraphDocument(doc, labels)
  const host = graph.nodes.find(node => node.id === 'host:host-ui')
  expect(host).toBeDefined()
  expect(host?.data).toMatchObject({ membership: 'catalog', meta: 'host' })
  expect(host?.data?.fill).not.toBe(styleForEnablement(true).fill)
})

it('draws Host-only bands when composition is empty but catalog is not', () => {
  const doc = fromInventory({ ...sample, rows: [] }, [
    { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
  ])
  const graph = toGraphDocument(doc, labels)
  expect(graph.nodes.some(node => node.id === 'empty')).toBe(false)
  expect(graph.nodes.some(node => node.id === 'host:host-ui')).toBe(true)
})
```

**步骤 2：跑测试确认失败**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/adapters.spec.ts
```

期望：FAIL — catalog 被忽略 / 仍出 empty。

**步骤 3：实现**

- 新增 `styleForCatalog(enabled)`（更淡 fill、更弱 stroke、更安静标签）。若 AITopo 已支持从 `data` 画虚线 stroke 再用；否则 F0 用淡实线即可。
- `layoutByArchitecturalLayer` / 分组循环：层内成员 = 该层 composition **再** 该层 catalog（各自保序）。
- 空态：仅当 `composition.length === 0 && catalog.length === 0` 才出 empty（broken 仍优先）。
- 节点 `data.membership`：`'composition' | 'catalog'`；catalog 的 meta 为 `'host'`。
- 若测试需要，从 package index 导出 `styleForCatalog`。

**步骤 4：跑测试确认通过**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/adapters.spec.ts
```

期望：PASS（按需更新仍假设图上无 Host 节点的期望）。

**步骤 5：提交**

```sh
git add plugins/agent-orchestrator/src/to-graph.ts plugins/agent-orchestrator/src/adapters.spec.ts plugins/agent-orchestrator/src/index.ts
git commit -m "$(cat <<'EOF'
Project Host catalog units onto the orchestrator layer canvas.

EOF
)"
```

---

### 任务 3：Client — 接入 `fromInventory`、文案、详情、hint

**文件：**
- 修改：`plugins/agent-orchestrator/src/client/OrchestratorView.tsx`
- 修改：`plugins/agent-orchestrator/src/client/locales.ts`
- 修改：`plugins/agent-orchestrator/src/activity.spec.ts`（仅当 live 假设被打破时）

**步骤 1：失败检查 / 文案键**

可抽纯函数测；否则用现有 activity 规格断言 `liveUnitIds` 只吃 `orchestrationDoc.composition`。

新增 locale（zh 为键集真源）：

| Key | zh | en |
|---|---|---|
| `hint.membership` | 实心 = 本 Preset · 淡色 = 宿主已加载 | Solid = this Preset · muted = Host loaded |
| `detail.membership` | 归属 | Membership |
| `detail.membership.composition` | 本 Preset | This Preset |
| `detail.membership.catalog` | 仅宿主（不在本 Preset） | Host only (not in this Preset) |

**步骤 2：实现 Client**

- 把 `listInventory()` 的 `entries` 放进 state（或在 effect 内与 presets 一起派生文档）。
- `orchestrationDoc = selected === null ? null : fromInventory(selected, entries)`，加载完成前 `entries` 默认 `[]`。
- 工具条：展示 `t('hint.membership')`（只读时附加或替换部分 hint；`liveActive` 时保留现有 live hint）。
- `UnitDetailPanel`：从 composition vs catalog 查归属并展示 membership 行。
- 选择 / `unitById`：同时索引 composition 与 catalog。

**步骤 3：跑聚焦测试**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/adapters.spec.ts src/from-inventory.spec.ts src/activity.spec.ts
```

期望：PASS。

**步骤 4：提交**

```sh
git add plugins/agent-orchestrator/src/client/OrchestratorView.tsx plugins/agent-orchestrator/src/client/locales.ts plugins/agent-orchestrator/src/activity.spec.ts
git commit -m "$(cat <<'EOF'
Show Host catalog membership in the orchestrator Client view.

EOF
)"
```

---

### 任务 4：Live 高亮仍仅 composition（守卫）

**文件：**
- 修改：`plugins/agent-orchestrator/src/activity.spec.ts` 和/或 `OrchestratorView.tsx` 中的 `map-tool-activity` 调用点

**步骤 1：失败测试**

```ts
it('does not map tools onto catalog-only host units', () => {
  const doc = fromInventory(sample, [
    { entryId: 'tool-fs', moduleName: '@deepseek-ai/dsh-tool-fs', enabled: true, fiberPhase: 'active' },
  ])
  // force a catalog unit whose label would match "read" if scanned
  const ids = liveUnitIds(doc.catalog, ['read'])
  // production path must pass composition only — assert OrchestratorView / helper contract:
  expect(liveUnitIds(doc.composition, ['read']).has('host:tool-fs')).toBe(false)
})
```

在测试中写明：`OrchestratorView` 只对 `orchestrationDoc.composition` 调用 `liveUnitIds`。若 Host Loader 项也在 composition 中，高亮仍落在 composition id。

**步骤 2：必要时修正调用点；跑 activity 规格**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/activity.spec.ts
```

**步骤 3：提交**

```sh
git add plugins/agent-orchestrator/src/client/OrchestratorView.tsx plugins/agent-orchestrator/src/activity.spec.ts
git commit -m "$(cat <<'EOF'
Keep orchestrator live tool highlight on composition units only.

EOF
)"
```

---

### 任务 5：README + Agent Note

**文件：**
- 修改：`plugins/agent-orchestrator/README.md` + `README.zh.md`
- 新建：`.agents/notes/implemented/feature/2026-09-08-orchestrator-host-catalog-on-canvas.md`（及配对所需 zh / i18n）
- 运行：对改动的配对执行 `pnpm run verify-translation-pairing --write`

**步骤 1：文档**

README「怎么跑 / How to run」：Preset 画布在同一 wiki/011 分带中以淡色显示未进入本 Preset 的 Host 已加载插件；实心为本 Preset 组合；重叠只保留一个实心节点。

Agent Note（implemented，现在时）：Client 用 Loader `entries` 经 entryId/moduleName 去重填入预留 `catalog[]`；画布投影两数组；live 高亮忽略 catalog——相对「单一 composition + membership 字段」，这样 F1 从 catalog 拖入 composition 仍对齐框架文档。

**步骤 2：配对 + 提交**

```sh
pnpm run verify-translation-pairing --write plugins/agent-orchestrator/README.md
# + note paths as required
git add plugins/agent-orchestrator/README.md plugins/agent-orchestrator/README.zh.md plugins/agent-orchestrator/README.i18n.yaml .agents/notes/implemented/feature/2026-09-08-orchestrator-host-catalog-on-canvas*
git commit -m "$(cat <<'EOF'
Document Host catalog projection on the orchestrator Preset canvas.

EOF
)"
```

---

### 任务 6：最终校验

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run
pnpm --filter dsh-agent-orchestrator bundle
```

可选手测：`pnpm dsh web --patch ./plugins/agent-orchestrator/cordis.patch.yml` → 编排 Tab → 确认淡色 Host 与实心 Preset 并存；切换 Preset 后 catalog 去重更新。

---

## 非范围（不要实现）

- AITopo 编辑 / 从 catalog 拖入 composition
- Host `agentOrchestrator.document()` 接入 Loader entries
- wiki/011 未加载包
- 跨 Preset 并集

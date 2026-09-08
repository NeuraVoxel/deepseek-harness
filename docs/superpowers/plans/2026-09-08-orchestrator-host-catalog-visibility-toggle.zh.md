# Host catalog 可见性开关 — 实现计划

[English](2026-09-08-orchestrator-host-catalog-visibility-toggle.md) | 中文

> **给 Claude：** REQUIRED SUB-SKILL: 用 superpowers:executing-plans 按任务实现本计划。

**目标：** 编排工具栏 checkbox 默认关闭，画布只显示当前 Preset 的 composition；勾选后在本 Tab 挂载内再次显示 Host-loaded catalog 节点。

**架构：** `fromInventory` 仍始终填满 `catalog[]`。新增纯函数 `documentForCanvas(doc, includeHostCatalog)`，隐藏时返回 `catalog: []`。`OrchestratorView` 持有 `showHostCatalog`（默认 `false`），经该辅助投影，隐藏时清除 catalog 选中，并调整 hint/locale。规格：[`../specs/2026-09-08-orchestrator-host-catalog-visibility-toggle-design.zh.md`](../specs/2026-09-08-orchestrator-host-catalog-visibility-toggle-design.zh.md)。

**技术栈：** TypeScript、vitest、React（`OrchestratorView` + locales + CSS）。

---

### 任务 1：纯画布文档过滤 + 测试

**文件：**
- 新建：`plugins/agent-orchestrator/src/document-for-canvas.ts`
- 新建：`plugins/agent-orchestrator/src/document-for-canvas.spec.ts`
- 修改：`plugins/agent-orchestrator/src/index.ts`（可选再导出）

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { documentForCanvas } from './document-for-canvas.ts'
import { fromInventory } from './from-inventory.ts'
import { toGraphDocument } from './to-graph.ts'
import type { PresetCompositionInput } from './types.ts'

const preset: PresetCompositionInput = {
  id: 'standard',
  trust: 'system',
  isDefault: true,
  rows: [
    { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true },
  ],
}

const labels = {
  layerGroup: (layer: string) => layer,
  empty: 'Empty',
  broken: 'Broken',
}

describe('documentForCanvas', () => {
  it('hides catalog when includeHostCatalog is false', () => {
    const full = fromInventory(preset, [
      { entryId: 'persona', moduleName: '@deepseek-ai/dsh-persona', enabled: true, fiberPhase: 'active' },
      { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
    ])
    expect(full.catalog).toHaveLength(1)
    const hidden = documentForCanvas(full, false)
    expect(hidden.catalog).toEqual([])
    expect(hidden.composition).toEqual(full.composition)
    const graph = toGraphDocument(hidden, labels)
    expect(graph.nodes.some(n => n.id.startsWith('host:'))).toBe(false)
  })

  it('keeps catalog when includeHostCatalog is true', () => {
    const full = fromInventory(preset, [
      { entryId: 'host-ui', moduleName: '@deepseek-ai/dsh-client', enabled: true, fiberPhase: 'active' },
    ])
    const shown = documentForCanvas(full, true)
    expect(shown.catalog).toEqual(full.catalog)
  })
})
```

**步骤 2：跑测试确认失败**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/document-for-canvas.spec.ts
```

**步骤 3：实现**

```ts
import type { OrchestrationDocument } from './types.ts'

/**
 * Document passed to canvas projection.
 * @param document - inventory-derived orchestration document.
 * @param includeHostCatalog - when false, omit Host-only catalog units.
 */
export function documentForCanvas(
  document: OrchestrationDocument,
  includeHostCatalog: boolean,
): OrchestrationDocument {
  if (includeHostCatalog) return document
  return { ...document, catalog: [] }
}
```

**步骤 4：通过并提交**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/document-for-canvas.spec.ts
git add plugins/agent-orchestrator/src/document-for-canvas.ts plugins/agent-orchestrator/src/document-for-canvas.spec.ts plugins/agent-orchestrator/src/index.ts
git commit -m "$(cat <<'EOF'
Add documentForCanvas to optionally hide Host catalog.

EOF
)"
```

---

### 任务 2：接入 `OrchestratorView` + locales

**文件：**
- 修改：`plugins/agent-orchestrator/src/client/OrchestratorView.tsx`
- 修改：`plugins/agent-orchestrator/src/client/OrchestratorView.module.css`
- 修改：`plugins/agent-orchestrator/src/client/locales.ts`

**步骤 1：状态 + 投影**

- `const [showHostCatalog, setShowHostCatalog] = useState(false)`
- 仍用 `fromInventory` 构建完整 `orchestrationDoc`（含 catalog）。
- `const canvasDoc = useMemo(() => orchestrationDoc === null ? null : documentForCanvas(orchestrationDoc, showHostCatalog), …)`
- `baseGraphDoc` / live 高亮 / `unitById` 使用 `canvasDoc`（隐藏时不含 catalog），细节面板无法打开画布外 Host 节点。
- 当 `showHostCatalog` 变为 false，若 `selectedUnitId` 落在完整 `orchestrationDoc.catalog` 上，清除选中 + `hostRef.current?.setSelection([])`。

**步骤 2：工具栏 UI**

在 Preset `<select>` 之后加入：

```tsx
<label className={css.hostCatalogToggle}>
  <input
    type="checkbox"
    checked={showHostCatalog}
    onChange={event => setShowHostCatalog(event.currentTarget.checked)}
  />
  {t('toolbar.showHostCatalog')}
</label>
```

CSS：横向 flex、12px 字号、间距，与工具栏对齐（不做卡片样式）。

**步骤 3：Locales**

```ts
'toolbar.showHostCatalog': '显示宿主已加载',
// en:
'toolbar.showHostCatalog': 'Show Host-loaded',
```

非 live 时的 hint：
- `showHostCatalog` → 现有 `hint.readonly` · `hint.membership`
- 否则 → `hint.readonly` · `hint.membershipPreset`（新建：zh「实心 = 本 Preset」/ en「Solid = this Preset」）

**步骤 4：手工确认** — bundle；方便时本地 web patch。

**步骤 5：提交**

```sh
git add plugins/agent-orchestrator/src/client/OrchestratorView.tsx plugins/agent-orchestrator/src/client/OrchestratorView.module.css plugins/agent-orchestrator/src/client/locales.ts
git commit -m "$(cat <<'EOF'
Add Orchestrate toolbar toggle for Host catalog visibility.

EOF
)"
```

---

### 任务 3：README + Agent Note + 验证

**文件：**
- 修改：`plugins/agent-orchestrator/README.md` + `.zh.md`
- 新建：`.agents/notes/implemented/feature/2026-09-08-orchestrator-host-catalog-visibility-toggle.md`（+ zh / i18n）

说明：默认仅 Preset 画布；checkbox 在本 Tab 会话内显示 Host-loaded；不持久化。

```sh
pnpm run verify-translation-pairing --write plugins/agent-orchestrator/README.md
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/2026-09-08-orchestrator-host-catalog-visibility-toggle.md
pnpm --filter dsh-agent-orchestrator exec vitest run
pnpm --filter dsh-agent-orchestrator bundle
git add …
git commit -m "$(cat <<'EOF'
Document Host catalog visibility toggle on Orchestrate.

EOF
)"
```

---

## 范围外

- localStorage / settings 持久化
- Host Remote / `agentOrchestrator.document()` 改动
- catalog 的 live 高亮

# Host catalog visibility toggle — Implementation Plan

English | [中文](2026-09-08-orchestrator-host-catalog-visibility-toggle.zh.md)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Orchestrate toolbar checkbox defaults off so the canvas shows only the current Preset’s composition; checking it shows Host-loaded catalog nodes again for this tab mount only.

**Architecture:** Keep `fromInventory` full `catalog[]`. Add a pure `documentForCanvas(doc, includeHostCatalog)` that returns `catalog: []` when hidden. `OrchestratorView` owns `showHostCatalog` state (default `false`), projects via the helper, clears catalog selection when hiding, and adjusts hint/locale. Spec: [`../specs/2026-09-08-orchestrator-host-catalog-visibility-toggle-design.md`](../specs/2026-09-08-orchestrator-host-catalog-visibility-toggle-design.md).

**Tech Stack:** TypeScript, vitest, React (`OrchestratorView` + locales + CSS).

---

### Task 1: Pure canvas document filter + tests

**Files:**
- Create: `plugins/agent-orchestrator/src/document-for-canvas.ts`
- Create: `plugins/agent-orchestrator/src/document-for-canvas.spec.ts`
- Modify: `plugins/agent-orchestrator/src/index.ts` (re-export optional)

**Step 1: Write the failing tests**

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

**Step 2: Run to verify fail**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/document-for-canvas.spec.ts
```

**Step 3: Implement**

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

**Step 4: Pass + commit**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/document-for-canvas.spec.ts
git add plugins/agent-orchestrator/src/document-for-canvas.ts plugins/agent-orchestrator/src/document-for-canvas.spec.ts plugins/agent-orchestrator/src/index.ts
git commit -m "$(cat <<'EOF'
Add documentForCanvas to optionally hide Host catalog.

EOF
)"
```

---

### Task 2: Wire checkbox into `OrchestratorView` + locales

**Files:**
- Modify: `plugins/agent-orchestrator/src/client/OrchestratorView.tsx`
- Modify: `plugins/agent-orchestrator/src/client/OrchestratorView.module.css`
- Modify: `plugins/agent-orchestrator/src/client/locales.ts`

**Step 1: State + projection**

- `const [showHostCatalog, setShowHostCatalog] = useState(false)`
- Build `orchestrationDoc` via `fromInventory` as today (full catalog).
- `const canvasDoc = useMemo(() => orchestrationDoc === null ? null : documentForCanvas(orchestrationDoc, showHostCatalog), …)`
- `baseGraphDoc` / live paint / `unitById` use `canvasDoc` (not full catalog when hidden), so detail cannot open off-canvas Host nodes.
- When `showHostCatalog` becomes false, if `selectedUnitId` is in full `orchestrationDoc.catalog`, clear selection + `hostRef.current?.setSelection([])`.

**Step 2: Toolbar UI**

After the Preset `<select>`, add:

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

CSS: flex row, 12px font, gap, align with toolbar (no card chrome).

**Step 3: Locales**

```ts
'toolbar.showHostCatalog': '显示宿主已加载',
// en:
'toolbar.showHostCatalog': 'Show Host-loaded',
```

Hint when not live:
- `showHostCatalog` → existing `hint.readonly` · `hint.membership`
- else → `hint.readonly` · `hint.membershipPreset` (new: zh「实心 = 本 Preset」/ en「Solid = this Preset」)

**Step 4: Manual sanity** — bundle; optional local web patch if easy.

**Step 5: Commit**

```sh
git add plugins/agent-orchestrator/src/client/OrchestratorView.tsx plugins/agent-orchestrator/src/client/OrchestratorView.module.css plugins/agent-orchestrator/src/client/locales.ts
git commit -m "$(cat <<'EOF'
Add Orchestrate toolbar toggle for Host catalog visibility.

EOF
)"
```

---

### Task 3: README + Agent Note + verify

**Files:**
- Modify: `plugins/agent-orchestrator/README.md` + `.zh.md`
- Create: `.agents/notes/implemented/feature/2026-09-08-orchestrator-host-catalog-visibility-toggle.md` (+ zh / i18n)

State: default Preset-only canvas; checkbox shows Host-loaded for the tab session; no persistence.

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

## Out of scope

- localStorage / settings persistence
- Host Remote / `agentOrchestrator.document()` changes
- Live paint on catalog

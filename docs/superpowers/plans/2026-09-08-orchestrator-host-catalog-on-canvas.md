# Host catalog on agent-orchestrator Preset canvas — Implementation Plan

English | [中文](2026-09-08-orchestrator-host-catalog-on-canvas.zh.md)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Every Preset page shows wiki/011-banded Host Loader plugins alongside that Preset’s composition, with muted style for Host-only nodes and solid style for in-Preset nodes; overlapping plugins merge into one composition node.

**Architecture:** Keep the change inside `plugins/agent-orchestrator`. Reuse `pluginInventory/list` (`entries` + `agentPresets`). Fill the reserved `catalog[]` with Loader rows that do not match the selected Preset’s composition; project `composition ∪ catalog` in `toGraphDocument`. Client builds the document via a new `fromInventory` helper (no new Remote). Live tool highlight continues to scan only `composition`. Spec: [`../specs/2026-09-08-orchestrator-host-catalog-on-canvas-design.md`](../specs/2026-09-08-orchestrator-host-catalog-on-canvas-design.md).

**Tech Stack:** TypeScript, vitest, React (OrchestratorView + locales), AITopo GraphDocument paint via `node.data`.

---

### Task 1: `fromInventory` — composition + Host catalog with dedupe

**Files:**
- Create: `plugins/agent-orchestrator/src/from-inventory.ts`
- Modify: `plugins/agent-orchestrator/src/from-preset.ts` (export shared row→unit helpers if needed; keep `fromPresetComposition` for Host-only callers)
- Modify: `plugins/agent-orchestrator/src/adapters.spec.ts` (or create `from-inventory.spec.ts`)
- Modify: `plugins/agent-orchestrator/src/index.ts` (re-export if other modules need it)

**Step 1: Write the failing tests**

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

**Step 2: Run test to verify it fails**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/from-inventory.spec.ts
```

Expected: FAIL — module missing or `fromInventory` undefined.

**Step 3: Implement**

- `matchesComposition(unit, entry)`: if both have non-empty `entryId`, compare ids; else compare `moduleName`.
- `fromInventory(preset, entries)`:
  1. `const base = fromPresetComposition(preset)`
  2. For each Loader entry, skip if any composition unit matches; else push a catalog unit with `id = host:${entryId}`, `locked: true`, layer from `resolveArchitecturalLayer(moduleName)`, `fiberPhase` from entry.
- Keep `fromPresetComposition` returning `catalog: []` for Host document() callers until they opt in.

**Step 4: Run test to verify it passes**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/from-inventory.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```sh
git add plugins/agent-orchestrator/src/from-inventory.ts plugins/agent-orchestrator/src/from-inventory.spec.ts plugins/agent-orchestrator/src/from-preset.ts plugins/agent-orchestrator/src/index.ts plugins/agent-orchestrator/src/adapters.spec.ts
git commit -m "$(cat <<'EOF'
Add fromInventory to fill orchestrator catalog from Loader entries.

EOF
)"
```

---

### Task 2: `toGraphDocument` — union layout + catalog paint + empty states

**Files:**
- Modify: `plugins/agent-orchestrator/src/to-graph.ts`
- Modify: `plugins/agent-orchestrator/src/adapters.spec.ts`

**Step 1: Write the failing tests**

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

**Step 2: Run test to verify it fails**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/adapters.spec.ts
```

Expected: FAIL — catalog ignored / empty note shown.

**Step 3: Implement**

- Add `styleForCatalog(enabled)` (muted fill, weaker stroke, quieter label colors). Prefer dashed stroke only if AITopo already paints stroke style from `data`; otherwise muted solid is enough for F0.
- `layoutByArchitecturalLayer` / group loop: members = composition units in layer **then** catalog units in layer (preserve each list’s order).
- Empty gate: show empty note only when `composition.length === 0 && catalog.length === 0` (broken still wins).
- Node `data.membership`: `'composition' | 'catalog'`; catalog meta caption `'host'`.
- Export `styleForCatalog` from package index if tests import it.

**Step 4: Run test to verify it passes**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/adapters.spec.ts
```

Expected: PASS (update any expectations that assumed `catalog: []` on graphs that now include Host nodes only when tests pass entries).

**Step 5: Commit**

```sh
git add plugins/agent-orchestrator/src/to-graph.ts plugins/agent-orchestrator/src/adapters.spec.ts plugins/agent-orchestrator/src/index.ts
git commit -m "$(cat <<'EOF'
Project Host catalog units onto the orchestrator layer canvas.

EOF
)"
```

---

### Task 3: Client — wire `fromInventory`, locales, detail, hint

**Files:**
- Modify: `plugins/agent-orchestrator/src/client/OrchestratorView.tsx`
- Modify: `plugins/agent-orchestrator/src/client/locales.ts`
- Modify: `plugins/agent-orchestrator/src/activity.spec.ts` (only if live assumptions break)

**Step 1: Write / extend failing checks**

Prefer a small pure helper test if extractable; otherwise assert via existing activity specs that `liveUnitIds` is only called with `orchestrationDoc.composition`.

Locale keys to add (zh source of truth):

| Key | zh | en |
|---|---|---|
| `hint.membership` | 实心 = 本 Preset · 淡色 = 宿主已加载 | Solid = this Preset · muted = Host loaded |
| `detail.membership` | 归属 | Membership |
| `detail.membership.composition` | 本 Preset | This Preset |
| `detail.membership.catalog` | 仅宿主（不在本 Preset） | Host only (not in this Preset) |

**Step 2: Implement Client**

- Keep `entries` from `listInventory()` in state (or derive doc inside the effect once presets are known).
- `orchestrationDoc = selected === null ? null : fromInventory(selected, entries)` with `entries` default `[]` until load completes.
- Toolbar: show `t('hint.membership')` (append or replace part of readonly hint — keep live hints as today when `liveActive`).
- `UnitDetailPanel`: read `membership` from graph selection **or** look up unit in `composition` vs `catalog`; show membership row.
- Selection / `unitById`: index **both** composition and catalog units.

**Step 3: Run focused tests**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/adapters.spec.ts src/from-inventory.spec.ts src/activity.spec.ts
```

Expected: PASS.

**Step 4: Commit**

```sh
git add plugins/agent-orchestrator/src/client/OrchestratorView.tsx plugins/agent-orchestrator/src/client/locales.ts plugins/agent-orchestrator/src/activity.spec.ts
git commit -m "$(cat <<'EOF'
Show Host catalog membership in the orchestrator Client view.

EOF
)"
```

---

### Task 4: Live highlight stays composition-only (guard)

**Files:**
- Modify: `plugins/agent-orchestrator/src/activity.spec.ts` and/or `map-tool-activity` call sites in `OrchestratorView.tsx`

**Step 1: Failing test**

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

Clarify in the test that `OrchestratorView` calls `liveUnitIds(orchestrationDoc.composition, …)` only. If a Host Loader entry is also in composition, highlight remains on the composition id.

**Step 2: Fix call site if needed; run activity specs**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/activity.spec.ts
```

**Step 3: Commit**

```sh
git add plugins/agent-orchestrator/src/client/OrchestratorView.tsx plugins/agent-orchestrator/src/activity.spec.ts
git commit -m "$(cat <<'EOF'
Keep orchestrator live tool highlight on composition units only.

EOF
)"
```

---

### Task 5: README + Agent Note

**Files:**
- Modify: `plugins/agent-orchestrator/README.md` + `README.zh.md`
- Create: `.agents/notes/implemented/feature/2026-09-08-orchestrator-host-catalog-on-canvas.md` (+ zh / i18n if the note tree requires pairing)
- Run: `pnpm run verify-translation-pairing --write` on touched pairs

**Step 1: Docs**

README “怎么跑 / How to run” paragraph: Preset canvas shows Host-loaded plugins that are not in the selected Preset as muted nodes in the same wiki/011 bands; solid nodes are the Preset composition; overlap is one solid node.

Agent Note (implemented, present tense): Client fills reserved `catalog[]` from Loader `entries` with entryId/moduleName dedupe; canvas projects both arrays; live highlight ignores catalog — chosen over a single `composition` array with a membership flag so F1 drag-from-catalog stays aligned with the framework document.

**Step 2: Pairing + commit**

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

### Task 6: Final verify

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run
pnpm --filter dsh-agent-orchestrator bundle
```

Manual (optional): `pnpm dsh web --patch ./plugins/agent-orchestrator/cordis.patch.yml` → Orchestrate tab → confirm muted Host nodes beside solid Preset nodes; switch Preset and confirm catalog re-dedupes.

---

## Out of scope (do not implement)

- AITopo editor / drag catalog → composition
- Host `agentOrchestrator.document()` taking Loader entries
- wiki/011 unloaded packages
- Cross-preset union

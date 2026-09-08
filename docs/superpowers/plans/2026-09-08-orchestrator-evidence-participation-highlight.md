# Evidence-based orchestrator participation highlight — Implementation Plan

English | [中文](2026-09-08-orchestrator-evidence-participation-highlight.zh.md)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** While a Session is running on the Orchestrate tab for that Session’s Preset, light every composition unit with Session-log evidence on the latest turn (tools + curated non-tool events), not Fiber mount status.

**Architecture:** Extend Client-only folding in `plugins/agent-orchestrator`. `deriveCompositionActivity` gains turn-scoped module hints from event types; `map-tool-activity` (or a sibling module) maps modules → composition unit ids and merges with existing tool→unit live sets. Spec: [`../specs/2026-09-08-orchestrator-evidence-participation-highlight-design.md`](../specs/2026-09-08-orchestrator-evidence-participation-highlight-design.md).

**Tech Stack:** TypeScript, vitest, existing Session event window types.

---

### Task 1: Event-type → module map + unit resolution

**Files:**
- Create: `plugins/agent-orchestrator/src/participation-map.ts`
- Create: `plugins/agent-orchestrator/src/participation-map.spec.ts`
- Modify: `plugins/agent-orchestrator/src/index.ts` (re-export if needed)

**Step 1: Write the failing tests**

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

**Step 2: Run test to verify it fails**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/participation-map.spec.ts
```

**Step 3: Implement** `EVENT_TYPE_TO_MODULES` (exact types + prefix helpers for `compaction/*`), `modulesForEventType`, `unitIdsForModules` (normalize / strip `@deepseek-ai/dsh-` leaf match like tools).

**Step 4: Pass + commit**

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run src/participation-map.spec.ts
git add plugins/agent-orchestrator/src/participation-map.ts plugins/agent-orchestrator/src/participation-map.spec.ts plugins/agent-orchestrator/src/index.ts
git commit -m "$(cat <<'EOF'
Add Session event to composition module participation map.

EOF
)"
```

---

### Task 2: Fold participation modules in `deriveCompositionActivity`

**Files:**
- Modify: `plugins/agent-orchestrator/src/client/derive-activity.ts`
- Modify: `plugins/agent-orchestrator/src/activity.spec.ts`

**Step 1: Extend `CompositionActivity`**

```ts
readonly turnModuleNames: readonly string[]
```

Empty when not running. Populate from events with `seq >= latestTurnStartSeq` via `modulesForEventType`. Deduplicate.

**Step 2: Tests**

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

Adjust fixture `data` shapes to match real `SessionEvent` types enough for the fold (cast as needed like existing tests).

**Step 3: Update `emptyCompositionActivity` / EMPTY constant.**

**Step 4: Commit**

```sh
git add plugins/agent-orchestrator/src/client/derive-activity.ts plugins/agent-orchestrator/src/activity.spec.ts
git commit -m "$(cat <<'EOF'
Derive turn module participation from Session events.

EOF
)"
```

---

### Task 3: Merge module hits into live paint

**Files:**
- Modify: `plugins/agent-orchestrator/src/client/OrchestratorView.tsx`
- Modify: `plugins/agent-orchestrator/src/activity.spec.ts` (or adapters) for merge helper if extracted

**Step 1:** When computing live ids:

```ts
const runningIds = liveUnitIds(orchestrationDoc.composition, activity.runningToolNames)
const turnToolIds = liveUnitIds(orchestrationDoc.composition, activity.turnToolNames)
const turnModuleIds = unitIdsForModules(orchestrationDoc.composition, activity.turnModuleNames)
const turnIds = new Set([...turnToolIds, ...turnModuleIds])
```

Pass `runningIds` / `turnIds` into `withLiveActivity` as today. Detail panel live check should include module hits for composition units.

**Step 2: Test** that a composition graph with compaction unit gets turn paint when `turnModuleNames` includes compaction (unit test on merge + `withLiveActivity`, not full React).

**Step 3: Commit**

```sh
git add plugins/agent-orchestrator/src/client/OrchestratorView.tsx plugins/agent-orchestrator/src/activity.spec.ts
git commit -m "$(cat <<'EOF'
Light composition units from turn event module participation.

EOF
)"
```

---

### Task 4: Expand tool aliases lightly (optional same PR)

If obvious gaps remain vs common tools in standard preset, add missing `TOOL_ALIASES` entries only — do **not** block on full gen-tool-catalog wiring this cut (spec allows deferring catalog generation).

---

### Task 5: README + Agent Note

**Files:**
- Modify: `plugins/agent-orchestrator/README.md` + `.zh.md`
- Create: `.agents/notes/implemented/feature/2026-09-08-orchestrator-evidence-participation-highlight.md` (+ zh / i18n)

State: live highlight uses Session-log evidence (tools + curated events); silent spine plugins stay dark; full tracing needs core changes.

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

### Task 6: Final verify

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run
pnpm --filter dsh-agent-orchestrator bundle
```

---

## Out of scope

- Fiber `active` as participation
- New Session events / Host Remote
- Generated tool-catalog import (optional follow-up)
- Lighting catalog / non-session Preset

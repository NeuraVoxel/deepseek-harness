# Orchestrate toolbar plugin counts — Implementation Plan

English | [中文](2026-09-08-orchestrator-plugin-count-stats.zh.md)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show read-only Preset vs Host-loaded plugin counts in the Orchestrate toolbar, always from the full inventory document for the selected Preset (independent of the Host-loaded checkbox).

**Architecture:** Keep counting on `orchestrationDoc` (`composition.length` / `catalog.length`). Do not use `canvasDoc` / `documentForCanvas` for counts. Add locale keys + muted inline toolbar text after the Preset select. Spec: [`../specs/2026-09-08-orchestrator-plugin-count-stats-design.md`](../specs/2026-09-08-orchestrator-plugin-count-stats-design.md).

**Tech Stack:** TypeScript, React (`OrchestratorView` + locales + CSS), optional thin helper + vitest.

---

### Task 1: Locale keys + toolbar count UI

**Files:**
- Modify: `plugins/agent-orchestrator/src/client/locales.ts`
- Modify: `plugins/agent-orchestrator/src/client/OrchestratorView.tsx`
- Modify: `plugins/agent-orchestrator/src/client/OrchestratorView.module.css`

**Step 1: Locales**

```ts
// zh
'toolbar.pluginCounts': '本 Preset {composition} · 宿主已加载 {catalog}',
// en
'toolbar.pluginCounts': 'This Preset {composition} · Host-loaded {catalog}',
```

**Step 2: Counts from full document**

When `orchestrationDoc !== null`, compute:

```ts
const compositionCount = orchestrationDoc.composition.length
const catalogCount = orchestrationDoc.catalog.length
```

Never derive these from `canvasDoc` (which may have `catalog: []` when the checkbox is off).

**Step 3: Toolbar UI**

After the Preset `<select>` (before the Host-loaded checkbox), render:

```tsx
<span className={css.pluginCounts} aria-live="polite">
  {t('toolbar.pluginCounts', {
    composition: compositionCount,
    catalog: catalogCount,
  })}
</span>
```

Only render when `orchestrationDoc` is available (same happy path that already shows the canvas).

CSS: 12px font, muted opacity (~0.7–0.85), no border/background/card chrome; flex-align with existing toolbar items.

**Step 4: Manual sanity** — with Host-loaded unchecked, catalog count stays non-zero when Host-only plugins exist; switching Preset updates both numbers.

**Step 5: Commit**

```sh
git add plugins/agent-orchestrator/src/client/locales.ts \
  plugins/agent-orchestrator/src/client/OrchestratorView.tsx \
  plugins/agent-orchestrator/src/client/OrchestratorView.module.css
git commit -m "$(cat <<'EOF'
Show Preset and Host-loaded plugin counts on Orchestrate.

EOF
)"
```

---

### Task 2: Optional count helper test + README

**Files:**
- Optional create: `plugins/agent-orchestrator/src/plugin-counts.ts` + `.spec.ts` if extracting `countsFromDocument(doc) => { composition, catalog }` keeps the “not from canvasDoc” rule testable without React.
- Modify: `plugins/agent-orchestrator/README.md` + `.zh.md` (one sentence that the toolbar shows Preset / Host-loaded counts from the full document).
- Create: `.agents/notes/implemented/feature/2026-09-08-orchestrator-plugin-count-stats.md` (+ zh / i18n) if the change is non-mechanical enough for an Agent Note; otherwise skip per note scope rules.

Prefer extracting the helper when a unit test is cheaper than view plumbing:

```ts
export function pluginCountsFromDocument(document: OrchestrationDocument): {
  composition: number
  catalog: number
} {
  return {
    composition: document.composition.length,
    catalog: document.catalog.length,
  }
}
```

Test: after `documentForCanvas(full, false)`, counts from `full` still report `full.catalog.length`; counts must not be taken from the filtered document for the toolbar.

```sh
pnpm --filter dsh-agent-orchestrator exec vitest run
pnpm run verify-translation-pairing --write plugins/agent-orchestrator/README.md
# if Agent Note:
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/2026-09-08-orchestrator-plugin-count-stats.md
git add …
git commit -m "$(cat <<'EOF'
Document Orchestrate toolbar plugin count stats.

EOF
)"
```

---

## Out of scope

- Counting only visible canvas nodes
- Persistence / Host Remote changes
- Session / Global product naming in UI copy
- Live highlight or detail panel changes

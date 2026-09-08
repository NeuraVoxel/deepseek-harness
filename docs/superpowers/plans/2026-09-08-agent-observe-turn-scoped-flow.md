# Turn-scoped agent-observe flow Implementation Plan

English | [中文](2026-09-08-agent-observe-turn-scoped-flow.zh.md)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clicking Open Observe on a Chat Turn opens the Observe flow canvas pinned to that Turn; Jump to latest clears the pin; fleet double-click always shows the latest Turn.

**Architecture:** Keep the change inside `plugins/agent-observe`. Extend `nav-store` with `focusTurn`. Dedupe `create(scopeKey)` on the store handle so Chat’s `ViewShortcut` and the Observe tab share one instance per Session (framework `defineStore` does not dedupe). Resolve Turn from `assistant/message.id === messageId`. Pass the shared nav instance into `createAgentFlowSource` so event and focus changes both re-project. Spec: [`../specs/2026-09-08-agent-observe-turn-scoped-flow.md`](../specs/2026-09-08-agent-observe-turn-scoped-flow.md).

**Tech Stack:** TypeScript, Cordis client slots, `@deepseek-ai/dsh-client-store`, vitest, React (ObserveView toolbar only).

---

### Task 1: Nav store — `focusTurn` + deduped `create`

**Files:**
- Modify: `plugins/agent-observe/src/client/nav-store.ts`
- Create: `plugins/agent-observe/src/client/nav-store.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { createObserveNavStore } from './nav-store.ts'

describe('createObserveNavStore', () => {
  it('dedupes create(scopeKey) so two callers share one instance', () => {
    const handle = createObserveNavStore()
    const a = handle.create('s1')
    const b = handle.create('s1')
    expect(a).toBe(b)
    a.actions.showFlow(3)
    expect(b.getSnapshot()).toEqual({ mode: 'flow', focusTurn: 3 })
  })

  it('showFlow without turn clears the pin; showLatest clears pin and stays in flow; showFleet clears pin', () => {
    const nav = createObserveNavStore().create('s1')
    nav.actions.showFlow(2)
    nav.actions.showFlow()
    expect(nav.getSnapshot()).toEqual({ mode: 'flow', focusTurn: null })
    nav.actions.showFlow(4)
    nav.actions.showLatest()
    expect(nav.getSnapshot()).toEqual({ mode: 'flow', focusTurn: null })
    nav.actions.showFlow(1)
    nav.actions.showFleet()
    expect(nav.getSnapshot()).toEqual({ mode: 'fleet', focusTurn: null })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter dsh-agent-observe test -- src/client/nav-store.spec.ts`

Expected: FAIL (module API / actions missing).

**Step 3: Write minimal implementation**

In `nav-store.ts`:

```ts
interface NavState {
  mode: ObserveViewMode
  focusTurn: number | null
}

type NavActions = {
  showFleet: (draft: NavState) => void
  showFlow: (draft: NavState, turn?: number) => void
  showLatest: (draft: NavState) => void
}

export function createObserveNavStore(): EngineStoreHandle<NavState, NavActions> {
  const inner = defineStore({
    init: (): NavState => ({ mode: 'fleet', focusTurn: null }),
    actions: {
      showFleet: (state) => {
        state.mode = 'fleet'
        state.focusTurn = null
      },
      showFlow: (state, turn?: number) => {
        state.mode = 'flow'
        state.focusTurn = turn === undefined ? null : turn
      },
      showLatest: (state) => {
        state.mode = 'flow'
        state.focusTurn = null
      },
    },
  })
  const cache = new Map<string, ReturnType<typeof inner.create>>()
  return {
    spec: inner.spec,
    create(scopeKey?: string) {
      const key = scopeKey ?? ''
      let instance = cache.get(key)
      if (instance === undefined) {
        instance = inner.create(scopeKey)
        cache.set(key, instance)
      }
      return instance
    },
  }
}
```

Update JSDoc: Chat shortcut and Observe tab must share one instance per Session via this cache.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter dsh-agent-observe test -- src/client/nav-store.spec.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/agent-observe/src/client/nav-store.ts plugins/agent-observe/src/client/nav-store.spec.ts
git commit -m "$(cat <<'EOF'
Add Observe nav focusTurn with per-session store dedupe.

EOF
)"
```

---

### Task 2: `messageId` → Turn helper

**Files:**
- Create: `plugins/agent-observe/src/client/resolve-turn.ts`
- Create: `plugins/agent-observe/src/client/resolve-turn.spec.ts`

**Step 1: Write the failing test**

Reuse event fixtures from `derive-flow.spec.ts` (two Turns, distinct `assistant/message` ids). Assert:

- known `messageId` → that Turn’s number
- unknown id → `undefined`
- empty window → `undefined`

**Step 2: Run test to verify it fails**

Run: `pnpm --filter dsh-agent-observe test -- src/client/resolve-turn.spec.ts`

Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

```ts
import type { SessionEventWindow } from '@deepseek-ai/dsh-api-session-controller/client'
import type { MessageId } from '@deepseek-ai/dsh-llm' // or session types — match existing imports

/**
 * Map a finalized assistant message id to its Session Turn.
 * @param window - Client event window.
 * @param messageId - durable assistant message id from assistant-actions.
 * @returns Turn number, or undefined when no matching assistant/message exists.
 */
export function resolveTurnFromMessageId(
  window: SessionEventWindow,
  messageId: string,
): number | undefined {
  for (const entry of window.entries) {
    if (entry.type !== 'event') continue
    const event = entry.event
    if (event.type !== 'assistant/message') continue
    if (event.data.message.id !== messageId) continue
    return event.data.turn
  }
  return undefined
}
```

(Adjust `MessageId` / import path to whatever the plugin already uses for message ids.)

**Step 4: Run test to verify it passes**

Run: `pnpm --filter dsh-agent-observe test -- src/client/resolve-turn.spec.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add plugins/agent-observe/src/client/resolve-turn.ts plugins/agent-observe/src/client/resolve-turn.spec.ts
git commit -m "$(cat <<'EOF'
Resolve Observe focus Turn from assistant message id.

EOF
)"
```

---

### Task 3: `deriveAgentFlow` accepts `focusTurn`

**Files:**
- Modify: `plugins/agent-observe/src/client/derive-flow.ts`
- Modify: `plugins/agent-observe/src/client/derive-flow.spec.ts`

**Step 1: Write the failing tests**

Add cases (build on existing multi-event helpers; add a second Turn with different user/assistant content):

1. `deriveAgentFlow(window, session, 1)` while Turn 2 is latest → `snapshot.turn === 1` and nodes only from Turn 1.
2. `deriveAgentFlow(window, session, null)` / omitted → latest Turn (current behavior).
3. `deriveAgentFlow(window, session, 99)` → `turn === 99`, `nodes.length === 0` (unavailable; do not retarget).
4. Pin Turn 1 after Turn 2 exists; Session `running: true` → Turn 1 nodes stay `done` / settled, not live-active from Turn 2.

Also extend `AgentFlowSnapshot` with `latestTurn: number | null` (always the Session max Turn, for the Jump button).

**Step 2: Run test to verify it fails**

Run: `pnpm --filter dsh-agent-observe test -- src/client/derive-flow.spec.ts`

Expected: FAIL on new cases / type errors.

**Step 3: Write minimal implementation**

```ts
export function deriveAgentFlow(
  window: SessionEventWindow,
  session: SessionSnapshot,
  focusTurn: number | null = null,
): AgentFlowSnapshot {
  // ... collect durable ...
  const latestTurn = findLatestTurn(durable)
  if (latestTurn === null && focusTurn === null) {
    return deriveEngagingFlow(session) // ensure latestTurn: null on EMPTY paths
  }
  const targetTurn = focusTurn ?? latestTurn
  if (targetTurn === null) {
    return { ...empty-with-latest, latestTurn }
  }
  if (focusTurn !== null && !durable.some(e =>
    (e.type === 'turn/start' || e.type === 'turn/end') && e.data.turn === focusTurn
  )) {
    return {
      turn: focusTurn,
      latestTurn,
      nodes: [],
      edges: [],
      running: session.running,
      updatedAt: new Date().toISOString(),
    }
  }
  const inTurn = eventsInTurn(durable, targetTurn)
  // replace every latestTurn local used as the fold target with targetTurn;
  // keep latestTurn only for the snapshot field
  ...
  return { turn: targetTurn, latestTurn, nodes, edges, running: session.running, updatedAt: ... }
}
```

Update `EMPTY` / `emptyAgentFlow` / `deriveEngagingFlow` to include `latestTurn: null`.

Update call sites and JSDoc (“latest turn” → “focus Turn or latest”).

**Step 4: Run test to verify it passes**

Run: `pnpm --filter dsh-agent-observe test -- src/client/derive-flow.spec.ts`

Expected: PASS (including prior cases).

**Step 5: Commit**

```bash
git add plugins/agent-observe/src/client/derive-flow.ts plugins/agent-observe/src/client/derive-flow.spec.ts
git commit -m "$(cat <<'EOF'
Derive agent-observe flow for an optional pinned Turn.

EOF
)"
```

---

### Task 4: Flow source subscribes to nav `focusTurn`

**Files:**
- Modify: `plugins/agent-observe/src/client/flow-source.ts`
- Modify: `plugins/agent-observe/src/client/index.ts` (wire nav instance into `flowSource`)
- Optional test: `plugins/agent-observe/src/client/flow-source.spec.ts` if cheap with fakes; otherwise covered by integration of Tasks 1+3 + manual smoke later.

**Step 1: Extend `createAgentFlowSource`**

```ts
import type { StoreInstance } from '@deepseek-ai/dsh-client-store'
import type { /* NavState + NavActions from nav-store — export types if needed */ } from './nav-store.ts'

export function createAgentFlowSource(
  binding: SessionBinding,
  nav: StoreInstance<{ mode: ...; focusTurn: number | null }, ...>,
): ObservableSnapshot<AgentFlowSnapshot> {
  const project = () => {
    try {
      return deriveAgentFlow(
        binding.eventSource.getSnapshot(),
        binding.session.getSnapshot(),
        nav.getSnapshot().focusTurn,
      )
    } catch (error: unknown) {
      console.error('agent-observe: deriveAgentFlow failed', error)
      return emptyAgentFlow()
    }
  }
  let snapshot = project()
  const listeners = new Set<() => void>()
  const refresh = (): void => {
    snapshot = project()
    for (const listener of [...listeners]) {
      try { listener() } catch (error: unknown) {
        console.error('agent-observe: agentFlow listener failed', error)
      }
    }
  }
  binding.eventSource.subscribe(refresh)
  binding.session.subscribe(refresh)
  nav.subscribe(refresh)
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
```

**Step 2: Wire in `index.ts`**

In `conversation.view` inject `(sessionId, _actions)`:

```ts
const binding = ctx.sessions.binding(sessionId)
const nav = navStore.create(sessionId) // same deduped instance the renderer uses
return {
  openSession: (id) => { ctx.sessions.open(id) },
  hooks: { agentFlow: flowSource(binding, nav) },
}
```

Update `flowSource` WeakMap keying: key by binding alone is OK if nav is always the deduped instance for that session; pass `nav` into `createAgentFlowSource` on first create.

**Step 3: Typecheck / test**

Run: `pnpm --filter dsh-agent-observe test && pnpm --filter dsh-agent-observe typecheck`

Expected: PASS

**Step 4: Commit**

```bash
git add plugins/agent-observe/src/client/flow-source.ts plugins/agent-observe/src/client/index.ts
git commit -m "$(cat <<'EOF'
Re-project Observe flow when nav focusTurn changes.

EOF
)"
```

---

### Task 5: ViewShortcut opens pinned flow

**Files:**
- Modify: `plugins/agent-observe/src/client/ViewShortcut.tsx`
- Modify: `plugins/agent-observe/src/client/index.ts` (assistant-actions inject)
- Modify: `plugins/agent-observe/src/client/locales.ts` only if tooltip copy changes (optional)

**Step 1: Inject face**

```ts
export interface ViewShortcutInjected {
  openObserveFlow: (messageId: MessageId) => void
}
```

In `apply`:

```ts
ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
  name: 'conversation.chat.assistant-actions',
  id: 'agent-observe',
  order: 30,
  locale: NS,
  inject: (sessionId): ViewShortcutInjected => ({
    openObserveFlow: (messageId) => {
      const binding = ctx.sessions.binding(sessionId)
      const turn = binding === undefined
        ? undefined
        : resolveTurnFromMessageId(binding.eventSource.getSnapshot(), messageId)
      const nav = navStore.create(sessionId)
      if (turn === undefined) nav.actions.showFlow()
      else nav.actions.showFlow(turn)
      openConversationViewTab(t('view.observe'))
    },
  }),
}, ViewShortcut))
```

**Step 2: Update component**

```tsx
export function ViewShortcut({ messageId, t, openObserveFlow }: ViewShortcutProps) {
  const label = t('dock.open')
  return (
    <span className={css.root} data-observe-shortcut="">
      <Tooltip label={label} side="bottom" delayMs={200}>
        <button
          type="button"
          className={css.trigger}
          aria-label={label}
          onClick={() => { openObserveFlow(messageId) }}
        >
          <IconBrowseOutline16 size={15} />
        </button>
      </Tooltip>
    </span>
  )
}
```

Update file JSDoc: opens Observe **flow** for the message’s Turn (via reverse lookup).

Fleet double-click already calls `actions.showFlow()` with no args — after Task 1 that clears the pin. Verify `FleetPane.openFlow` still uses bare `showFlow()`.

**Step 3: Typecheck**

Run: `pnpm --filter dsh-agent-observe typecheck`

Expected: PASS

**Step 4: Commit**

```bash
git add plugins/agent-observe/src/client/ViewShortcut.tsx plugins/agent-observe/src/client/index.ts
git commit -m "$(cat <<'EOF'
Open Observe flow pinned to the Chat Turn shortcut.

EOF
)"
```

---

### Task 6: Flow toolbar — Jump to latest

**Files:**
- Modify: `plugins/agent-observe/src/client/ObserveView.tsx`
- Modify: `plugins/agent-observe/src/client/locales.ts` (zh + en keys)
- Modify: `plugins/agent-observe/src/client/ObserveView.module.css` if a toolbar button gap is needed (reuse `groupButton`)

**Step 1: Add locale keys**

```ts
// zh
'flow.jumpLatest': '跳到最新',
// en
'flow.jumpLatest': 'Jump to latest',
```

**Step 2: Toolbar UI in `FlowPane`**

```tsx
const focusTurn = props.useStore(state => state.focusTurn)
const flow = useAgentFlow(state => state)
const showJump = focusTurn !== null
  && flow.latestTurn !== null
  && focusTurn !== flow.latestTurn

// in toolbar, after title:
{showJump ? (
  <button
    type="button"
    className={css.groupButton}
    onClick={() => { actions.showLatest() }}
  >
    {t('flow.jumpLatest')}
  </button>
) : null}
```

**Step 3: Typecheck / test**

Run: `pnpm --filter dsh-agent-observe test && pnpm --filter dsh-agent-observe typecheck`

Expected: PASS

**Step 4: Commit**

```bash
git add plugins/agent-observe/src/client/ObserveView.tsx plugins/agent-observe/src/client/locales.ts plugins/agent-observe/src/client/ObserveView.module.css
git commit -m "$(cat <<'EOF'
Add Jump to latest on pinned Observe flow.

EOF
)"
```

---

### Task 7: Docs + Agent Note

**Files:**
- Modify: `plugins/agent-observe/README.md`
- Modify: `plugins/agent-observe/README.zh.md`
- Create: `.agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.md`
- Create: `.agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.zh.md`
- Create: `.agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.i18n.yaml` (via `pnpm run verify-translation-pairing --write …`)

**Step 1: README bullets**

Replace “Turn-scoped payload injection is deferred” with:

- Open Observe on a Turn → flow canvas for that Turn (pinned)
- Fleet double-click → latest Turn
- Jump to latest when pinned away from latest
- Limitation: Turn identity from `assistant/message.id` match; no `packages/` owner-prop change

**Step 2: Agent Note**

Follow uniform format (`Status: implemented`, `## Problem`, decision, alternatives rejected — especially extending `AssistantActionOwnerProps` — consequences, required verification). Link the superpowers spec. Use `@dsh-prose-standard` / `@dsh-archive-agent-notes` checklist for supersession (search for older observe / Turn shortcut notes).

**Step 3: Pairing + format gates**

```bash
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.md
pnpm run verify-translation-pairing --write plugins/agent-observe/README.md
# narrow note format if needed:
pnpm exec tsx scripts/verify-agent-note-format.ts .agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.md
```

**Step 4: Commit**

```bash
git add plugins/agent-observe/README.md plugins/agent-observe/README.zh.md \
  plugins/agent-observe/README.i18n.yaml \
  .agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.md \
  .agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.zh.md \
  .agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.i18n.yaml
git commit -m "$(cat <<'EOF'
Document Turn-scoped Observe flow and record the decision.

EOF
)"
```

---

### Task 8: Final package verification

**Step 1: Run**

```bash
pnpm --filter dsh-agent-observe test
pnpm --filter dsh-agent-observe typecheck
pnpm --filter dsh-agent-observe bundle
```

Expected: all green.

**Step 2: Manual smoke (optional, needs web + patch)**

```bash
pnpm dsh web --patch ./plugins/agent-observe/cordis.patch.yml
```

- Multi-Turn Session → Open Observe on Turn 1 → title Turn 1, Jump to latest visible
- Jump to latest → Turn N
- Double-click fleet node → latest
- Open Observe on latest → no Jump button

**Step 3: Commit only if smoke fixed anything; otherwise done.**

---

## Execution notes

- Do **not** modify `packages/client/ui-chat` (spec option 1).
- Do **not** add Turn prev/next.
- `showFleet` must clear `focusTurn` (Task 1).
- Deduped `create` is load-bearing: without it, the shortcut mutates a different store than the Observe tab.

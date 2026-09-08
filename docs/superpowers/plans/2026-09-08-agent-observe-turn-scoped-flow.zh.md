# Turn-scoped agent-observe flow 实现计划

[English](2026-09-08-agent-observe-turn-scoped-flow.md) | 中文

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 在 Chat 某轮点 Open Observe 时，打开钉住该 Turn 的 Observe 流程画布；「跳到最新」清除钉住；舰队双击始终展示最新 Turn。

**架构：** 变更仅在 `plugins/agent-observe`。`nav-store` 增加 `focusTurn`。在 store handle 上对 `create(scopeKey)` 去重，使 Chat 的 `ViewShortcut` 与 Observe Tab 共享同一 Session 实例（框架 `defineStore` 不去重）。用 `assistant/message.id === messageId` 反查 Turn。把共享 nav 实例传入 `createAgentFlowSource`，使事件与焦点变化都会重投影。规格：[`../specs/2026-09-08-agent-observe-turn-scoped-flow.zh.md`](../specs/2026-09-08-agent-observe-turn-scoped-flow.zh.md)。

**技术栈：** TypeScript、Cordis client slots、`@deepseek-ai/dsh-client-store`、vitest、React（仅 ObserveView 工具栏）。

---

### Task 1: Nav store — `focusTurn` + 去重的 `create`

**文件：**
- 修改：`plugins/agent-observe/src/client/nav-store.ts`
- 新建：`plugins/agent-observe/src/client/nav-store.spec.ts`

**Step 1: 写失败测试**

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

**Step 2: 跑测试确认失败**

运行：`pnpm --filter dsh-agent-observe test -- src/client/nav-store.spec.ts`

期望：FAIL（模块 API / actions 缺失）。

**Step 3: 写最小实现**

在 `nav-store.ts`：

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

更新 JSDoc：Chat 快捷入口与 Observe Tab 必须通过此缓存共享每个 Session 的同一实例。

**Step 4: 跑测试确认通过**

运行：`pnpm --filter dsh-agent-observe test -- src/client/nav-store.spec.ts`

期望：PASS

**Step 5: 提交**

```bash
git add plugins/agent-observe/src/client/nav-store.ts plugins/agent-observe/src/client/nav-store.spec.ts
git commit -m "$(cat <<'EOF'
Add Observe nav focusTurn with per-session store dedupe.

EOF
)"
```

---

### Task 2: `messageId` → Turn 辅助函数

**文件：**
- 新建：`plugins/agent-observe/src/client/resolve-turn.ts`
- 新建：`plugins/agent-observe/src/client/resolve-turn.spec.ts`

**Step 1: 写失败测试**

复用 `derive-flow.spec.ts` 的事件夹具（两轮 Turn、不同的 `assistant/message` id）。断言：

- 已知 `messageId` → 该 Turn 号
- 未知 id → `undefined`
- 空窗口 → `undefined`

**Step 2: 跑测试确认失败**

运行：`pnpm --filter dsh-agent-observe test -- src/client/resolve-turn.spec.ts`

期望：FAIL（模块不存在）。

**Step 3: 写最小实现**

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

（按插件现有用法调整 `MessageId` / import 路径。）

**Step 4: 跑测试确认通过**

运行：`pnpm --filter dsh-agent-observe test -- src/client/resolve-turn.spec.ts`

期望：PASS

**Step 5: 提交**

```bash
git add plugins/agent-observe/src/client/resolve-turn.ts plugins/agent-observe/src/client/resolve-turn.spec.ts
git commit -m "$(cat <<'EOF'
Resolve Observe focus Turn from assistant message id.

EOF
)"
```

---

### Task 3: `deriveAgentFlow` 接受 `focusTurn`

**文件：**
- 修改：`plugins/agent-observe/src/client/derive-flow.ts`
- 修改：`plugins/agent-observe/src/client/derive-flow.spec.ts`

**Step 1: 写失败测试**

新增用例（基于现有多事件辅助；再加一轮不同 user/assistant 内容的 Turn）：

1. 最新为 Turn 2 时 `deriveAgentFlow(window, session, 1)` → `snapshot.turn === 1` 且节点仅来自 Turn 1。
2. `deriveAgentFlow(window, session, null)` / 省略 → 最新 Turn（与今天一致）。
3. `deriveAgentFlow(window, session, 99)` → `turn === 99`，`nodes.length === 0`（不可用；不改钉）。
4. 已有 Turn 2 时钉住 Turn 1；Session `running: true` → Turn 1 节点保持 `done` / 已结算，不被 Turn 2 带成 live-active。

同时给 `AgentFlowSnapshot` 增加 `latestTurn: number | null`（始终为 Session 最大 Turn，供跳到最新按钮使用）。

**Step 2: 跑测试确认失败**

运行：`pnpm --filter dsh-agent-observe test -- src/client/derive-flow.spec.ts`

期望：FAIL（新用例 / 类型错误）。

**Step 3: 写最小实现**

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

更新 `EMPTY` / `emptyAgentFlow` / `deriveEngagingFlow`，包含 `latestTurn: null`。

更新调用点与 JSDoc（「最新 Turn」→「焦点 Turn 或最新」）。

**Step 4: 跑测试确认通过**

运行：`pnpm --filter dsh-agent-observe test -- src/client/derive-flow.spec.ts`

期望：PASS（含既有用例）。

**Step 5: 提交**

```bash
git add plugins/agent-observe/src/client/derive-flow.ts plugins/agent-observe/src/client/derive-flow.spec.ts
git commit -m "$(cat <<'EOF'
Derive agent-observe flow for an optional pinned Turn.

EOF
)"
```

---

### Task 4: Flow source 订阅 nav 的 `focusTurn`

**文件：**
- 修改：`plugins/agent-observe/src/client/flow-source.ts`
- 修改：`plugins/agent-observe/src/client/index.ts` (wire nav instance into `flowSource`)
- 可选测试：`plugins/agent-observe/src/client/flow-source.spec.ts` 若假对象成本低则加；否则由 Task 1+3 集成与后续手工冒烟覆盖。

**Step 1: 扩展 `createAgentFlowSource`**

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

**Step 2: 在 `index.ts` 接线**

在 `conversation.view` 的 inject `(sessionId, _actions)`：

```ts
const binding = ctx.sessions.binding(sessionId)
const nav = navStore.create(sessionId) // same deduped instance the renderer uses
return {
  openSession: (id) => { ctx.sessions.open(id) },
  hooks: { agentFlow: flowSource(binding, nav) },
}
```

更新 `flowSource` 的 WeakMap 键：若 nav 始终是该 Session 的去重实例，仅按 binding 键即可；首次创建时把 `nav` 传入 `createAgentFlowSource`。

**Step 3: Typecheck / 测试**

运行：`pnpm --filter dsh-agent-observe test && pnpm --filter dsh-agent-observe typecheck`

期望：PASS

**Step 4: 提交**

```bash
git add plugins/agent-observe/src/client/flow-source.ts plugins/agent-observe/src/client/index.ts
git commit -m "$(cat <<'EOF'
Re-project Observe flow when nav focusTurn changes.

EOF
)"
```

---

### Task 5: ViewShortcut 打开钉住的 flow

**文件：**
- 修改：`plugins/agent-observe/src/client/ViewShortcut.tsx`
- 修改：`plugins/agent-observe/src/client/index.ts` (assistant-actions inject)
- 修改：`plugins/agent-observe/src/client/locales.ts` 仅当 tooltip 文案变化时（可选）

**Step 1: Inject 面**

```ts
export interface ViewShortcutInjected {
  openObserveFlow: (messageId: MessageId) => void
}
```

在 `apply`：

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

**Step 2: 更新组件**

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

更新文件 JSDoc：为该消息的 Turn 打开 Observe **flow**（经反查）。

舰队双击已调用无参 `actions.showFlow()` — Task 1 之后会清钉。确认 `FleetPane.openFlow` 仍使用裸 `showFlow()`。

**Step 3: Typecheck**

运行：`pnpm --filter dsh-agent-observe typecheck`

期望：PASS

**Step 4: 提交**

```bash
git add plugins/agent-observe/src/client/ViewShortcut.tsx plugins/agent-observe/src/client/index.ts
git commit -m "$(cat <<'EOF'
Open Observe flow pinned to the Chat Turn shortcut.

EOF
)"
```

---

### Task 6: Flow 工具栏 — 跳到最新

**文件：**
- 修改：`plugins/agent-observe/src/client/ObserveView.tsx`
- 修改：`plugins/agent-observe/src/client/locales.ts`（zh + en 键）
- 修改：`plugins/agent-observe/src/client/ObserveView.module.css` 若需要工具栏按钮间距（复用 `groupButton`）

**Step 1: 增加 locale 键**

```ts
// zh
'flow.jumpLatest': '跳到最新',
// en
'flow.jumpLatest': 'Jump to latest',
```

**Step 2: `FlowPane` 工具栏 UI**

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

**Step 3: Typecheck / 测试**

运行：`pnpm --filter dsh-agent-observe test && pnpm --filter dsh-agent-observe typecheck`

期望：PASS

**Step 4: 提交**

```bash
git add plugins/agent-observe/src/client/ObserveView.tsx plugins/agent-observe/src/client/locales.ts plugins/agent-observe/src/client/ObserveView.module.css
git commit -m "$(cat <<'EOF'
Add Jump to latest on pinned Observe flow.

EOF
)"
```

---

### Task 7: 文档 + Agent Note

**文件：**
- 修改：`plugins/agent-observe/README.md`
- 修改：`plugins/agent-observe/README.zh.md`
- 新建：`.agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.md`
- 新建：`.agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.zh.md`
- 新建：`.agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.i18n.yaml`（经 `pnpm run verify-translation-pairing --write …`）

**Step 1: README 条目**

将 “Turn-scoped payload injection is deferred” 替换为：

- 在某 Turn 上 Open Observe → 该 Turn 的 flow 画布（钉住）
- 舰队双击 → 最新 Turn
- 钉住非最新时显示跳到最新
- 限制：Turn 身份来自 `assistant/message.id` 匹配；不改 `packages/` 的 owner props

**Step 2: Agent Note**

遵循统一格式（`Status: implemented`、`## Problem`、决策、否决的替代方案——尤其是扩展 `AssistantActionOwnerProps`——后果、必做验证）。链接 superpowers 规格。用 `@dsh-prose-standard` / `@dsh-archive-agent-notes` 清单做 supersession 检查（搜索更早的 observe / Turn 快捷入口笔记）。

**Step 3: 配对 + 格式门禁**

```bash
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.md
pnpm run verify-translation-pairing --write plugins/agent-observe/README.md
# narrow note format if needed:
pnpm exec tsx scripts/verify-agent-note-format.ts .agents/notes/implemented/feature/2026-09-08-agent-observe-turn-scoped-flow.md
```

**Step 4: 提交**

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

### Task 8: 最终包验证

**Step 1: 运行**

```bash
pnpm --filter dsh-agent-observe test
pnpm --filter dsh-agent-observe typecheck
pnpm --filter dsh-agent-observe bundle
```

期望：全部通过。

**Step 2: 手工冒烟（可选，需要 web + patch）**

```bash
pnpm dsh web --patch ./plugins/agent-observe/cordis.patch.yml
```

- 多 Turn Session → 在 Turn 1 上 Open Observe → 标题为 Turn 1，可见跳到最新
- 跳到最新 → Turn N
- 双击舰队节点 → 最新
- 在最新轮 Open Observe → 无跳到最新按钮

**Step 3: 仅当冒烟修了问题才提交；否则结束。**

---

## 执行注意

- **不要**改 `packages/client/ui-chat`（规格选项 1）。
- **不要**加 Turn prev/next。
- `showFleet` 必须清除 `focusTurn`（Task 1）。
- 去重的 `create` 是负载要点：否则快捷入口写入的 store 与 Observe Tab 不是同一个。

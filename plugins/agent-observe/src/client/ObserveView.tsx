/** Conversation Observe tab: fleet topology + per-Agent process flow (AITopo). */

import {
  useMemo, useRef, useState,
  type ReactElement,
  type RefObject,
} from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  SessionEventWindow,
  SessionSnapshot,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveClientTopology } from './derive-topology.ts'
import type { AgentFlowSnapshot } from './derive-flow.ts'
import type { AgentObserveGroupMode } from '../types.ts'
import { NS } from './locales.ts'
import type { createObserveNavStore } from './nav-store.ts'
import {
  AITopoHost,
  formatZoomPercent,
  type AITopoHostHandle,
  type GraphEvent,
} from './aitopo/AITopoHost.tsx'
import { snapshotToDocument } from './aitopo/snapshot-to-document.ts'
import { FLOW_DIMENSIONS, resolveFlowDimension } from './flow-dimensions/registry.ts'
import { deriveEventsDimension } from './flow-dimensions/events/index.ts'
import { EventsPane } from './flow-dimensions/events/EventsPane.tsx'
import type {
  EventListFilter,
  FlowDimensionSelection,
  FlowNodeInspect,
} from './flow-dimensions/types.ts'
import css from './ObserveView.module.css'

/** Injected callbacks and hooks from the plugin apply closure. */
export interface ObserveViewInjected {
  /** Open a Session as the current conversation target. */
  openSession: (sessionId: SessionId) => void
  hooks: {
    /** Latest-turn process topology for the current Session. */
    agentFlow: import('@deepseek-ai/dsh-client-store').ObservableSnapshot<AgentFlowSnapshot>
    /** Contiguous Session event window for skeleton overlays and events. */
    eventWindow: import('@deepseek-ai/dsh-client-store').ObservableSnapshot<SessionEventWindow>
    /** Session lifecycle snapshot. */
    sessionLife: import('@deepseek-ai/dsh-client-store').ObservableSnapshot<SessionSnapshot>
  }
}

type NavHandle = ReturnType<typeof createObserveNavStore>
type Props = ConvViewProps
  & PropsLocale<typeof NS>
  & PropsStore<NavHandle>
  & InjectFace<ObserveViewInjected>
  & {
    useAgentFlow: SnapshotSelectorHook<AgentFlowSnapshot>
    useEventWindow: SnapshotSelectorHook<SessionEventWindow>
    useSessionLife: SnapshotSelectorHook<SessionSnapshot>
  }

const GROUP_MODES: readonly AgentObserveGroupMode[] = ['workspace', 'tree', 'teams']

/**
 * Canvas conversation view (fleet overview or Agent process flow).
 * @param props - conversation standard props + locale + store + inject.
 */
export function ObserveView(props: Props): ReactElement {
  const mode = props.useStore(state => state.mode)
  if (mode === 'flow') return <FlowPane {...props} />
  return <FleetPane {...props} />
}

function FleetPane(props: Props): ReactElement {
  const {
    useSessions, useWorkspaces, sessionId, t, openSession, actions,
  } = props
  const [groupMode, setGroupMode] = useState<AgentObserveGroupMode>('workspace')
  const [zoom, setZoom] = useState(1)
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null)
  const hostRef = useRef<AITopoHostHandle>(null)
  const sessions = useSessions(state => state)
  const workspaces = useWorkspaces(state => state)

  const snapshot = useMemo(
    () => deriveClientTopology(sessions, workspaces),
    [sessions, workspaces],
  )

  const workspaceTitles = useMemo(() => {
    const map = new Map<string, string>()
    for (const workspace of workspaces.items) {
      map.set(workspace.workspaceId, workspace.title)
    }
    return map
  }, [workspaces])

  /** Same order as the Harness Workspaces sidebar list. */
  const workspaceOrder = useMemo(
    () => workspaces.items.map(workspace => workspace.workspaceId),
    [workspaces],
  )

  const adapted = useMemo(() => snapshotToDocument({
    snapshot,
    groupMode,
    labels: {
      ungrouped: t('ungrouped'),
      workspaceTitle: id => workspaceTitles.get(id) ?? id,
    },
    currentSessionId: sessionId,
    workspaceOrder,
  }), [snapshot, groupMode, t, workspaceTitles, workspaceOrder, sessionId])

  const selectedIds = useMemo(
    () => (sessionId === undefined ? [] : [sessionId as string]),
    [sessionId],
  )

  const openFlow = (id: SessionId): void => {
    if (id !== sessionId) openSession(id)
    actions.showFlow()
  }

  const onEvent = (event: GraphEvent): void => {
    switch (event.type) {
      case 'viewportChanged':
        setZoom(event.viewport.zoom)
        break
      case 'subNetworkChanged':
        setActiveNetworkId(event.activeNetworkId)
        break
      case 'nodeActivated': {
        if (event.detail === 'click') {
          openSession(event.nodeId as SessionId)
          return
        }
        const node = adapted.document.nodes.find(n => n.id === event.nodeId)
        if (groupMode === 'teams' && node?.networkId !== undefined && activeNetworkId === null) {
          hostRef.current?.enterSubNetwork(node.networkId)
          return
        }
        openFlow(event.nodeId as SessionId)
        break
      }
      default:
        break
    }
  }

  if (snapshot.nodes.length === 0) {
    return (
      <div className={css.root}>
        <div className={css.empty}>{t('empty')}</div>
      </div>
    )
  }

  return (
    <div className={css.root} data-conversation-composer-overlay="">
      <div className={css.toolbar}>
        <span className={css.groupLabel}>{t('toolbar.group')}</span>
        <div className={css.groupButtons} role="group" aria-label={t('toolbar.group')}>
          {GROUP_MODES.map(item => (
            <button
              key={item}
              type="button"
              className={css.groupButton}
              data-active={groupMode === item ? 'true' : 'false'}
              onClick={() => {
                setGroupMode(item)
                setActiveNetworkId(null)
              }}
            >
              {t(`group.${item}`)}
            </button>
          ))}
        </div>
        {activeNetworkId !== null ? (
          <button
            type="button"
            className={css.groupButton}
            onClick={() => { hostRef.current?.exitSubNetwork() }}
          >
            {t('subnetwork.back')}
          </button>
        ) : null}
        <ZoomControls t={t} zoom={zoom} hostRef={hostRef} />
        <div className={css.legend} aria-label={t('legend.title')}>
          <span><i className={`${css.swatch} ${css.swatchRunning}`} />{t('status.running')}</span>
          <span><i className={`${css.swatch} ${css.swatchIdle}`} />{t('status.idle')}</span>
          <span><i className={`${css.swatch} ${css.swatchCold}`} />{t('status.cold')}</span>
          <span><i className={`${css.swatch} ${css.swatchArchived}`} />{t('status.archived')}</span>
        </div>
        <span className={css.hint}>{t('hint.zoom')}</span>
      </div>
      {groupMode === 'teams' && !adapted.hasTeamNetworks ? (
        <div className={css.teamsNote}>{t('group.teams.unavailable')}</div>
      ) : null}
      <AITopoHost
        ref={hostRef}
        className={css.stage}
        ariaLabel={t('view.observe')}
        document={adapted.document}
        selectedIds={selectedIds}
        fitToken={`${groupMode}:${adapted.layout.width}x${adapted.layout.height}`}
        onEvent={onEvent}
      />
    </div>
  )
}

function FlowPane(props: Props): ReactElement {
  const {
    t, actions, useAgentFlow, useEventWindow, useSessionLife, sessionId,
  } = props
  const focusTurn = props.useStore(state => state.focusTurn)
  const dimension = props.useStore(state => state.dimension)
  const flow = useAgentFlow(state => state)
  const window = useEventWindow(state => state)
  const sessionLife = useSessionLife(state => state)
  const [eventFilter, setEventFilter] = useState<EventListFilter>('all')
  const [selection, setSelection] = useState<FlowDimensionSelection>({
    nodeId: null,
    eventId: null,
  })
  const [inspection, setInspection] = useState<{
    inspect: FlowNodeInspect
    label: string
  } | null>(null)
  const hostRef = useRef<AITopoHostHandle>(null)
  const [zoom, setZoom] = useState(1)

  const showJump = focusTurn !== null
    && flow.latestTurn !== null
    && focusTurn !== flow.latestTurn

  const ctx = useMemo(() => ({
    sessionId: sessionId ?? ('' as SessionId),
    focusTurn,
    window,
    session: sessionLife,
    agentFlow: flow,
    // Selection is UI-only; keep it out of derive inputs so node picks do not
    // rebuild the GraphDocument and fight wheel zoom / pan.
    selection: { nodeId: null, eventId: null } satisfies FlowDimensionSelection,
    t: t as (key: string, params?: Record<string, string>) => string,
  }), [sessionId, focusTurn, window, sessionLife, flow, t])

  const view = useMemo(() => {
    if (dimension === 'events') {
      return deriveEventsDimension({
        ...ctx,
        selection,
      }, eventFilter)
    }
    return resolveFlowDimension(dimension).derive(ctx)
  }, [dimension, ctx, eventFilter, selection])

  const selectedIds = useMemo(() => {
    if (selection.nodeId === null) return []
    return [selection.nodeId]
  }, [selection.nodeId])

  const onEvent = (event: GraphEvent): void => {
    switch (event.type) {
      case 'viewportChanged':
        setZoom(event.viewport.zoom)
        break
      case 'selectionChanged': {
        const selectedId = event.selectedIds[0]
        if (selectedId === undefined) {
          setInspection(null)
          setSelection(prev => ({ ...prev, nodeId: null }))
          return
        }
        setSelection(prev => ({ ...prev, nodeId: selectedId }))
        if (view.kind !== 'graph') {
          setInspection(null)
          return
        }
        const inspect = view.inspectByNodeId?.get(selectedId)
        const label = view.document.nodes.find(node => node.id === selectedId)?.label ?? selectedId
        setInspection({
          inspect: inspect ?? { detail: label },
          label,
        })
        break
      }
      default:
        break
    }
  }

  const onBlankDoubleClick = (clientX: number, clientY: number): void => {
    if (view.kind !== 'graph' || !view.blankDoubleClickToFleet) return
    if (hostRef.current?.hitTestAt(clientX, clientY) !== undefined) return
    setInspection(null)
    actions.showFleet()
  }

  return (
    <div className={css.root} data-conversation-composer-overlay="">
      <div className={css.toolbar}>
        <button type="button" className={css.groupButton} onClick={() => { actions.showFleet() }}>
          {t('flow.back')}
        </button>
        <span className={css.flowTitle}>
          {flow.turn === null || flow.turn === 0
            ? t('flow.title.none')
            : t('flow.title', { turn: String(flow.turn) })}
        </span>
        {showJump ? (
          <button type="button" className={css.groupButton} onClick={() => { actions.showLatest() }}>
            {t('flow.jumpLatest')}
          </button>
        ) : null}
        <span className={css.hint}>{truncate(String(sessionId), 24)}</span>
        {view.kind === 'graph' ? (
          <ZoomControls t={t} zoom={zoom} hostRef={hostRef} />
        ) : null}
        {view.kind === 'graph' && view.legend === 'process' ? (
          <div className={css.legend} aria-label={t('legend.title')}>
            <span><i className={`${css.swatch} ${css.swatchKindInput}`} />{t('flow.kind.client-input')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindPrompt}`} />{t('flow.kind.remote-prompt')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindFollow}`} />{t('flow.kind.remote-follow')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindAdmit}`} />{t('flow.kind.host-admit')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindProfile}`} />{t('flow.kind.profile')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindSession}`} />{t('flow.kind.session')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindEnvelope}`} />{t('flow.kind.envelope')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindMemory}`} />{t('flow.kind.memory')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindContext}`} />{t('flow.kind.context')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindModel}`} />{t('flow.kind.model')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindTool}`} />{t('flow.kind.tool')}</span>
            <span><i className={`${css.swatch} ${css.swatchKindRender}`} />{t('flow.kind.client-render')}</span>
            <span><i className={`${css.swatch} ${css.swatchEdgeFlow}`} />{t('flow.edge.flow')}</span>
            <span><i className={`${css.swatch} ${css.swatchEdgeData}`} />{t('flow.edge.data')}</span>
            <span><i className={`${css.swatch} ${css.swatchFlowActive}`} />{t('flow.legend.active')}</span>
          </div>
        ) : null}
        {view.kind === 'graph' && view.legend === 'status' ? (
          <div className={css.legend} aria-label={t('legend.title')}>
            <span><i className={`${css.swatch} ${css.swatchFlowPending}`} />{t('flow.legend.pending')}</span>
            <span><i className={`${css.swatch} ${css.swatchFlowActive}`} />{t('flow.legend.active')}</span>
            <span><i className={`${css.swatch} ${css.swatchFlowDone}`} />{t('flow.legend.done')}</span>
            <span><i className={`${css.swatch} ${css.swatchFlowError}`} />{t('flow.legend.error')}</span>
            <span><i className={`${css.swatch} ${css.swatchEdgeFlow}`} />{t('flow.edge.flow')}</span>
            <span><i className={`${css.swatch} ${css.swatchEdgeData}`} />{t('flow.edge.data')}</span>
          </div>
        ) : null}
        {view.kind === 'graph' ? (
          <span className={css.hint}>{t('flow.hint.blank')}</span>
        ) : null}
      </div>
      <div className={css.dimTabs} role="tablist" aria-label={t('flow.dim.group')}>
        {FLOW_DIMENSIONS.map(module => (
          <button
            key={module.id}
            type="button"
            role="tab"
            className={css.dimTab}
            aria-selected={dimension === module.id}
            data-active={dimension === module.id ? 'true' : 'false'}
            onClick={() => {
              setInspection(null)
              actions.setDimension(module.id)
            }}
          >
            {t(module.labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>
      {view.kind === 'events' ? (
        <EventsPane
          t={t as (key: string, params?: Record<string, string>) => string}
          entries={view.entries}
          selected={view.selected}
          filter={eventFilter}
          onFilter={setEventFilter}
          onSelect={entry => {
            setSelection({
              eventId: entry.id,
              nodeId: entry.linkedNodeId ?? null,
            })
          }}
        />
      ) : view.document.nodes.length === 0 ? (
        <div
          className={css.empty}
          onDoubleClick={() => {
            setInspection(null)
            actions.showFleet()
          }}
        >
          {t('flow.empty')}
        </div>
      ) : (
        <div
          className={css.flowStageWrap}
          onDoubleClick={event => {
            onBlankDoubleClick(event.clientX, event.clientY)
          }}
        >
          <AITopoHost
            ref={hostRef}
            className={css.stage}
            ariaLabel={t('flow.title.none')}
            document={view.document}
            selectedIds={selectedIds}
            fitToken={`${dimension}:${flow.turn ?? 0}:${view.document.nodes.length}`}
            onEvent={onEvent}
          />
          {view.kind === 'graph' ? (
            <FlowInspectorPanel
              t={t}
              inspection={inspection}
              onClose={() => {
                setInspection(null)
                setSelection(prev => ({ ...prev, nodeId: null }))
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

function FlowInspectorPanel(props: {
  t: Props['t']
  inspection: {
    inspect: FlowNodeInspect
    label: string
  } | null
  onClose: () => void
}): ReactElement {
  const { t, inspection, onClose } = props
  const inspect = inspection?.inspect
  const hasIo = inspect !== undefined && (
    (inspect.inputText !== undefined && inspect.inputText !== '')
    || (inspect.outputText !== undefined && inspect.outputText !== '')
  )
  const hasDetail = inspect?.detail !== undefined && inspect.detail !== ''
  return (
    <aside className={css.inspector} aria-label={t('flow.panel.title')}>
      <div className={css.inspectorHeader}>
        <div className={css.inspectorTitle}>
          {inspection?.label ?? t('flow.panel.title')}
        </div>
        {inspection !== null ? (
          <button type="button" className={css.groupButton} onClick={onClose}>
            {t('flow.panel.close')}
          </button>
        ) : null}
      </div>
      {inspection === null ? (
        <div className={css.inspectorEmpty}>{t('flow.panel.empty')}</div>
      ) : (
        <div className={css.inspectorBody}>
          {hasDetail ? (
            <>
              <div className={css.inspectorSection}>{t('flow.panel.detail')}</div>
              <pre className={css.inspectorPre}>{inspect!.detail}</pre>
            </>
          ) : null}
          {hasIo ? (
            <>
              <div className={css.inspectorSection}>{t('flow.hover.input')}</div>
              <pre className={css.inspectorPre}>{inspect!.inputText || '—'}</pre>
              <div className={css.inspectorSection}>{t('flow.hover.output')}</div>
              <pre className={css.inspectorPre}>{inspect!.outputText || '—'}</pre>
            </>
          ) : null}
          {!hasDetail && !hasIo ? (
            <div className={css.inspectorEmpty}>{t('flow.panel.empty')}</div>
          ) : null}
        </div>
      )}
    </aside>
  )
}

function ZoomControls(props: {
  t: Props['t']
  zoom: number
  hostRef: RefObject<AITopoHostHandle | null>
}): ReactElement {
  const { t, zoom, hostRef } = props
  return (
    <div className={css.zoomControls} role="group" aria-label={t('zoom.group')}>
      <button type="button" className={css.groupButton} onClick={() => { hostRef.current?.zoomOut() }} aria-label={t('zoom.out')}>−</button>
      <span className={css.zoomBadge}>{formatZoomPercent(zoom)}</span>
      <button type="button" className={css.groupButton} onClick={() => { hostRef.current?.zoomIn() }} aria-label={t('zoom.in')}>+</button>
      <button type="button" className={css.groupButton} onClick={() => { hostRef.current?.resetZoom() }}>{t('zoom.reset')}</button>
      <button type="button" className={css.groupButton} onClick={() => { hostRef.current?.fitContent() }}>
        {t('zoom.fit')}
      </button>
    </div>
  )
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** Conversation Canvas tab: fleet topology + per-Agent process flow (AITopo). */

import {
  useMemo, useRef, useState,
  type ReactElement,
  type RefObject,
  type SyntheticEvent,
} from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveClientTopology } from './derive-topology.ts'
import type { AgentFlowNode, AgentFlowSnapshot } from './derive-flow.ts'
import type { AgentCanvasGroupMode } from '../types.ts'
import { NS } from './locales.ts'
import type { createCanvasNavStore } from './nav-store.ts'
import {
  AITopoHost,
  formatZoomPercent,
  type AITopoHostHandle,
  type GraphEvent,
} from './aitopo/AITopoHost.tsx'
import { snapshotToDocument } from './aitopo/snapshot-to-document.ts'
import { flowToDocument } from './aitopo/flow-to-document.ts'
import css from './CanvasView.module.css'

/** Injected callbacks and hooks from the plugin apply closure. */
export interface CanvasViewInjected {
  /** Open a Session as the current conversation target. */
  openSession: (sessionId: SessionId) => void
  hooks: {
    /** Latest-turn process topology for the current Session. */
    agentFlow: import('@deepseek-ai/dsh-client-store').ObservableSnapshot<AgentFlowSnapshot>
  }
}

type NavHandle = ReturnType<typeof createCanvasNavStore>
type Props = ConvViewProps
  & PropsLocale<typeof NS>
  & PropsStore<NavHandle>
  & InjectFace<CanvasViewInjected>
  & { useAgentFlow: SnapshotSelectorHook<AgentFlowSnapshot> }

const GROUP_MODES: readonly AgentCanvasGroupMode[] = ['workspace', 'tree', 'teams']

/**
 * Canvas conversation view (fleet overview or Agent process flow).
 * @param props - conversation standard props + locale + store + inject.
 */
export function CanvasView(props: Props): ReactElement {
  const mode = props.useStore(state => state.mode)
  if (mode === 'flow') return <FlowPane {...props} />
  return <FleetPane {...props} />
}

function FleetPane(props: Props): ReactElement {
  const {
    useSessions, useWorkspaces, sessionId, t, openSession, actions,
  } = props
  const [groupMode, setGroupMode] = useState<AgentCanvasGroupMode>('workspace')
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

  const adapted = useMemo(() => snapshotToDocument({
    snapshot,
    groupMode,
    labels: {
      ungrouped: t('ungrouped'),
      workspaceTitle: id => workspaceTitles.get(id) ?? id,
    },
    currentSessionId: sessionId,
  }), [snapshot, groupMode, t, workspaceTitles, sessionId])

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
        ariaLabel={t('view.canvas')}
        document={adapted.document}
        selectedIds={selectedIds}
        fitToken={`${groupMode}:${adapted.layout.width}x${adapted.layout.height}`}
        onEvent={onEvent}
      />
    </div>
  )
}

function FlowPane(props: Props): ReactElement {
  const { t, actions, useAgentFlow, sessionId } = props
  const flow = useAgentFlow(state => state)
  const adapted = useMemo(() => flowToDocument(flow, {
    join: t('flow.join'),
    parallel: t('flow.parallel'),
  }), [flow, t])
  const hostRef = useRef<AITopoHostHandle>(null)
  const [zoom, setZoom] = useState(1)
  /** IO tooltip pinned at the click that selected the node; null when nothing is selected. */
  const [inspection, setInspection] = useState<{
    node: AgentFlowNode
    clientX: number
    clientY: number
  } | null>(null)
  /** Latest pointer position; capture-phase pointerdown records the click before AITopo selects. */
  const pointerRef = useRef({ x: 0, y: 0 })
  const nodeById = useMemo(
    () => new Map(flow.nodes.map(node => [node.id, node])),
    [flow.nodes],
  )

  const onEvent = (event: GraphEvent): void => {
    switch (event.type) {
      case 'viewportChanged':
        setZoom(event.viewport.zoom)
        break
      case 'selectionChanged': {
        const selectedId = event.selectedIds[0]
        if (selectedId === undefined) {
          setInspection(null)
          return
        }
        const node = nodeById.get(selectedId)
        if (node === undefined) {
          setInspection(null)
          return
        }
        setInspection({
          node,
          clientX: pointerRef.current.x,
          clientY: pointerRef.current.y,
        })
        break
      }
      default:
        break
    }
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
        <span className={css.hint}>{truncate(String(sessionId), 24)}</span>
        <ZoomControls t={t} zoom={zoom} hostRef={hostRef} />
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
      </div>
      {adapted.layout.nodes.length === 0 ? (
        <div className={css.empty}>{t('flow.empty')}</div>
      ) : (
        <div
          className={css.flowStageWrap}
          onPointerDownCapture={event => {
            pointerRef.current = { x: event.clientX, y: event.clientY }
          }}
        >
          <AITopoHost
            ref={hostRef}
            className={css.stage}
            ariaLabel={t('flow.title.none')}
            document={adapted.document}
            fitToken={`${flow.turn ?? 0}:${adapted.layout.width}x${adapted.layout.height}`}
            onEvent={onEvent}
          />
          {inspection !== null ? (
            <FlowIoTooltip
              t={t}
              node={inspection.node}
              clientX={inspection.clientX}
              clientY={inspection.clientY}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

function FlowIoTooltip(props: {
  t: Props['t']
  node: AgentFlowNode
  clientX: number
  clientY: number
}): ReactElement {
  const { t, node, clientX, clientY } = props
  const left = Math.min(clientX + 14, typeof window !== 'undefined' ? window.innerWidth - 360 : clientX + 14)
  const top = Math.min(clientY + 14, typeof window !== 'undefined' ? window.innerHeight - 280 : clientY + 14)
  /** Keep pointer work on the panel (select / copy / scroll) off the canvas stage. */
  const stopCanvasPointer = (event: SyntheticEvent): void => {
    event.stopPropagation()
  }
  return (
    <div
      className={css.ioTooltip}
      style={{ left, top }}
      role="dialog"
      aria-label={node.label}
      onPointerDown={stopCanvasPointer}
      onPointerMove={stopCanvasPointer}
      onPointerUp={stopCanvasPointer}
      onWheel={stopCanvasPointer}
      onClick={stopCanvasPointer}
    >
      <div className={css.ioTooltipTitle}>{node.label}</div>
      <div className={css.ioTooltipSection}>{t('flow.hover.input')}</div>
      <pre className={css.ioTooltipBody}>{node.inputText || '—'}</pre>
      <div className={css.ioTooltipSection}>{t('flow.hover.output')}</div>
      <pre className={css.ioTooltipBody}>{node.outputText || '—'}</pre>
    </div>
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

/** Conversation Canvas tab: fleet topology + per-Agent process flow. */

import {
  useEffect, useMemo, useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement, type ReactNode, type RefObject,
} from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveClientTopology } from './derive-topology.ts'
import type { AgentFlowNode, AgentFlowSnapshot, FlowNodeKind } from './derive-flow.ts'
import { layoutTopology, NODE_SIZE } from './layout.ts'
import { flowAnchor, layoutAgentFlow, type LaidOutFlowNode } from './layout-flow.ts'
import type { AgentCanvasGroupMode } from '../types.ts'
import { NS } from './locales.ts'
import type { createCanvasNavStore } from './nav-store.ts'
import { formatZoomPercent, useCanvasViewport } from './use-canvas-viewport.ts'
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
  const sessions = useSessions(state => state)
  const workspaces = useWorkspaces(state => state)
  const viewport = useCanvasViewport()

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

  const layout = useMemo(() => layoutTopology(snapshot, groupMode, {
    ungrouped: t('ungrouped'),
    workspaceTitle: id => workspaceTitles.get(id) ?? id,
  }), [snapshot, groupMode, t, workspaceTitles])

  const nodeById = useMemo(
    () => new Map(layout.nodes.map(node => [node.id as string, node])),
    [layout.nodes],
  )

  useEffect(() => {
    viewport.fit(layout.width, layout.height)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit on layout identity
  }, [layout.width, layout.height, groupMode])

  const openFlow = (id: SessionId): void => {
    if (id !== sessionId) openSession(id)
    actions.showFlow()
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
              onClick={() => { setGroupMode(item) }}
            >
              {t(`group.${item}`)}
            </button>
          ))}
        </div>
        <ZoomControls t={t} viewport={viewport} contentWidth={layout.width} contentHeight={layout.height} />
        <div className={css.legend} aria-label={t('legend.title')}>
          <span><i className={`${css.swatch} ${css.swatchRunning}`} />{t('status.running')}</span>
          <span><i className={`${css.swatch} ${css.swatchIdle}`} />{t('status.idle')}</span>
          <span><i className={`${css.swatch} ${css.swatchCold}`} />{t('status.cold')}</span>
        </div>
        <span className={css.hint}>{t('hint.zoom')}</span>
      </div>
      {groupMode === 'teams' ? (
        <div className={css.teamsNote}>{t('group.teams.unavailable')}</div>
      ) : null}
      <ZoomStage viewport={viewport} label={t('view.canvas')}>
        <defs>
          <marker id="agent-canvas-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#5a6478" />
          </marker>
        </defs>
        {layout.groups.map(group => (
          <g key={group.key}>
            <rect className={css.groupRect} x={group.x} y={group.y} width={group.width} height={group.height} />
            <text className={css.groupTitle} x={group.x + 14} y={group.y + 18}>{group.label}</text>
          </g>
        ))}
        {snapshot.edges.map(edge => {
          const from = nodeById.get(edge.from as string)
          const to = nodeById.get(edge.to as string)
          if (from === undefined || to === undefined) return null
          const x1 = from.x + NODE_SIZE.width / 2
          const y1 = from.y + NODE_SIZE.height
          const x2 = to.x + NODE_SIZE.width / 2
          const y2 = to.y
          return (
            <path
              key={`${edge.kind}:${edge.from}:${edge.to}`}
              className={css.edge}
              d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
            />
          )
        })}
        {layout.nodes.map(node => {
          const statusClass = node.status === 'running'
            ? css.nodeRunning
            : node.status === 'cold' ? css.nodeCold : css.nodeIdle
          const current = node.id === sessionId
          return (
            <g
              key={node.id}
              data-canvas-node="true"
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => { openSession(node.id) }}
              onDoubleClick={(event) => {
                event.preventDefault()
                openFlow(node.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.shiftKey) openFlow(node.id)
                else if (event.key === 'Enter') openSession(node.id)
              }}
              role="button"
              tabIndex={0}
              aria-label={node.title}
            >
              <rect
                className={`${css.nodeRect} ${statusClass}${current ? ` ${css.nodeCurrent}` : ''}`}
                width={NODE_SIZE.width}
                height={NODE_SIZE.height}
              />
              <text className={css.nodeTitle} x={12} y={20}>{truncate(node.title, 18)}</text>
              <text className={css.nodeMeta} x={12} y={36}>
                {t(`status.${node.status}`)}
                {node.origin === 'subagent' ? ' · sub' : ''}
              </text>
            </g>
          )
        })}
      </ZoomStage>
    </div>
  )
}

function FlowPane(props: Props): ReactElement {
  const { t, actions, useAgentFlow, sessionId } = props
  const flow = useAgentFlow(state => state)
  const layout = useMemo(() => layoutAgentFlow(flow), [flow])
  const nodeById = useMemo(
    () => new Map(layout.nodes.map(node => [node.id, node])),
    [layout.nodes],
  )
  const viewport = useCanvasViewport()
  const [hover, setHover] = useState<{
    node: AgentFlowNode
    clientX: number
    clientY: number
  } | null>(null)

  useEffect(() => {
    if (layout.nodes.length === 0) return
    viewport.fit(layout.width, layout.height)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit when graph size changes
  }, [layout.width, layout.height, flow.turn])

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
        <ZoomControls t={t} viewport={viewport} contentWidth={layout.width} contentHeight={layout.height} />
        <div className={css.legend} aria-label={t('legend.title')}>
          <span><i className={`${css.swatch} ${css.swatchKindInput}`} />{t('flow.kind.client-input')}</span>
          <span><i className={`${css.swatch} ${css.swatchKindAdmit}`} />{t('flow.kind.host-admit')}</span>
          <span><i className={`${css.swatch} ${css.swatchKindStep}`} />{t('flow.kind.step')}</span>
          <span><i className={`${css.swatch} ${css.swatchKindModel}`} />{t('flow.kind.model')}</span>
          <span><i className={`${css.swatch} ${css.swatchKindTool}`} />{t('flow.kind.tool')}</span>
          <span><i className={`${css.swatch} ${css.swatchFlowActive}`} />{t('flow.legend.active')}</span>
        </div>
      </div>
      {layout.nodes.length === 0 ? (
        <div className={css.empty}>{t('flow.empty')}</div>
      ) : (
        <div className={css.flowStageWrap}>
          <ZoomStage viewport={viewport} label={t('flow.title.none')}>
            <defs>
              <marker id="agent-flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#5a6478" />
              </marker>
            </defs>
            {layout.groups.map(group => (
              <g key={group.key}>
                <rect
                  className={css.stepGroupRect}
                  x={group.x}
                  y={group.y}
                  width={group.width}
                  height={group.height}
                />
                <text className={css.groupTitle} x={group.x + 14} y={group.y + 18}>{group.label}</text>
              </g>
            ))}
            {layout.edges.map(edge => {
              const from = nodeById.get(edge.from)
              const to = nodeById.get(edge.to)
              if (from === undefined || to === undefined) return null
              const a = flowAnchor(from, 'right')
              const b = flowAnchor(to, 'left')
              return (
                <path
                  key={`${edge.from}->${edge.to}`}
                  className={css.flowEdge}
                  markerEnd="url(#agent-flow-arrow)"
                  d={`M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`}
                />
              )
            })}
            {layout.nodes.map(node => (
              <FlowNodeGlyph
                key={node.id}
                node={node}
                onHover={(clientX, clientY) => { setHover({ node, clientX, clientY }) }}
                onLeave={() => { setHover(null) }}
              />
            ))}
          </ZoomStage>
          {hover !== null ? (
            <FlowIoTooltip
              t={t}
              node={hover.node}
              clientX={hover.clientX}
              clientY={hover.clientY}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

function FlowNodeGlyph(props: {
  node: LaidOutFlowNode
  onHover: (clientX: number, clientY: number) => void
  onLeave: () => void
}): ReactElement {
  const { node, onHover, onLeave } = props
  const kindClass = kindCss(node.kind)
  const statusClass = node.status === 'active' ? css.flowStatusActive
    : node.status === 'done' ? css.flowStatusDone
      : node.status === 'error' ? css.flowStatusError
        : css.flowStatusPending
  const pulse = node.status === 'active' ? ` ${css.flowPulse}` : ''

  const handlers = {
    onMouseEnter: (event: ReactMouseEvent) => { onHover(event.clientX, event.clientY) },
    onMouseMove: (event: ReactMouseEvent) => { onHover(event.clientX, event.clientY) },
    onMouseLeave: () => { onLeave() },
  }

  if (node.kind === 'tool' && node.radius !== undefined) {
    return (
      <g
        data-canvas-node="true"
        className={css.flowNodeHit}
        {...handlers}
      >
        <circle
          className={`${css.flowTool} ${kindClass} ${statusClass}${pulse}`}
          cx={node.x}
          cy={node.y}
          r={node.radius}
        />
        <text
          className={css.flowToolLabel}
          x={node.x}
          y={node.y + 4}
          textAnchor="middle"
        >
          {truncate(node.label, 8)}
        </text>
      </g>
    )
  }

  return (
    <g
      data-canvas-node="true"
      className={css.flowNodeHit}
      transform={`translate(${node.x}, ${node.y})`}
      {...handlers}
    >
      <rect
        className={`${css.flowNode} ${kindClass} ${statusClass}${pulse}`}
        width={node.width}
        height={node.height}
      />
      <text className={css.nodeTitle} x={10} y={22}>{truncate(node.label, 16)}</text>
      <text className={css.nodeMeta} x={10} y={40}>{truncate(node.detail ?? node.kind, 18)}</text>
    </g>
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
  return (
    <div
      className={css.ioTooltip}
      style={{ left, top }}
      role="tooltip"
    >
      <div className={css.ioTooltipTitle}>{node.label}</div>
      <div className={css.ioTooltipSection}>{t('flow.hover.input')}</div>
      <pre className={css.ioTooltipBody}>{node.inputText || '—'}</pre>
      <div className={css.ioTooltipSection}>{t('flow.hover.output')}</div>
      <pre className={css.ioTooltipBody}>{node.outputText || '—'}</pre>
    </div>
  )
}

function kindCss(kind: FlowNodeKind): string {
  switch (kind) {
    case 'client-input': return css.kindClientInput!
    case 'host-admit': return css.kindHostAdmit!
    case 'step': return css.kindStep!
    case 'model': return css.kindModel!
    case 'tool': return css.kindTool!
    case 'turn-end': return css.kindTurnEnd!
    case 'client-render': return css.kindClientRender!
  }
}

function ZoomControls(props: {
  t: Props['t']
  viewport: ReturnType<typeof useCanvasViewport>
  contentWidth: number
  contentHeight: number
}): ReactElement {
  const { t, viewport, contentWidth, contentHeight } = props
  return (
    <div className={css.zoomControls} role="group" aria-label={t('zoom.group')}>
      <button type="button" className={css.groupButton} onClick={() => { viewport.zoomOut() }} aria-label={t('zoom.out')}>−</button>
      <span className={css.zoomBadge}>{formatZoomPercent(viewport.viewport.zoom)}</span>
      <button type="button" className={css.groupButton} onClick={() => { viewport.zoomIn() }} aria-label={t('zoom.in')}>+</button>
      <button type="button" className={css.groupButton} onClick={() => { viewport.reset() }}>{t('zoom.reset')}</button>
      <button
        type="button"
        className={css.groupButton}
        onClick={() => { viewport.fit(contentWidth, contentHeight) }}
      >
        {t('zoom.fit')}
      </button>
    </div>
  )
}

function ZoomStage(props: {
  viewport: ReturnType<typeof useCanvasViewport>
  label: string
  children: ReactNode
}): ReactElement {
  const { viewport, label, children } = props
  return (
    <svg
      ref={viewport.stageRef as RefObject<SVGSVGElement>}
      className={`${css.stageSvg}${viewport.dragging ? ` ${css.stageDragging}` : ''}`}
      viewBox={viewport.viewBox}
      preserveAspectRatio="xMidYMid meet"
      onWheel={viewport.onWheel}
      onPointerDown={viewport.onPointerDown}
      onPointerMove={viewport.onPointerMove}
      onPointerUp={viewport.onPointerUp}
      onPointerCancel={viewport.onPointerUp}
      role="region"
      aria-label={label}
    >
      {children}
    </svg>
  )
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

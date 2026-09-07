/** Conversation Canvas tab: Agent / Session topology. */

import { useMemo, useState, type ReactElement } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveClientTopology } from './derive-topology.ts'
import { layoutTopology, NODE_SIZE } from './layout.ts'
import type { AgentCanvasGroupMode } from '../types.ts'
import { NS } from './locales.ts'
import css from './CanvasView.module.css'

/** Injected callbacks from the plugin apply closure. */
export interface CanvasViewInjected {
  /** Open a Session as the current conversation target. */
  openSession: (sessionId: SessionId) => void
}

type Props = ConvViewProps & PropsLocale<typeof NS> & InjectFace<CanvasViewInjected>

const GROUP_MODES: readonly AgentCanvasGroupMode[] = ['workspace', 'tree', 'teams']

/**
 * Canvas conversation view.
 * @param props - conversation standard props + locale + inject.
 */
export function CanvasView(props: Props): ReactElement {
  const {
    useSessions, useWorkspaces, sessionId, t, openSession,
  } = props
  const [mode, setMode] = useState<AgentCanvasGroupMode>('workspace')

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

  const layout = useMemo(() => layoutTopology(snapshot, mode, {
    ungrouped: t('ungrouped'),
    workspaceTitle: id => workspaceTitles.get(id) ?? id,
  }), [snapshot, mode, t, workspaceTitles])

  const nodeById = useMemo(
    () => new Map(layout.nodes.map(node => [node.id as string, node])),
    [layout.nodes],
  )

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
          {GROUP_MODES.map(groupMode => (
            <button
              key={groupMode}
              type="button"
              className={css.groupButton}
              data-active={mode === groupMode ? 'true' : 'false'}
              onClick={() => { setMode(groupMode) }}
            >
              {t(`group.${groupMode}`)}
            </button>
          ))}
        </div>
        <div className={css.legend} aria-label={t('legend.title')}>
          <span><i className={`${css.swatch} ${css.swatchRunning}`} />{t('status.running')}</span>
          <span><i className={`${css.swatch} ${css.swatchIdle}`} />{t('status.idle')}</span>
          <span><i className={`${css.swatch} ${css.swatchCold}`} />{t('status.cold')}</span>
        </div>
        <span className={css.hint}>{t('hint.clientApprox')}</span>
      </div>
      {mode === 'teams' ? (
        <div className={css.teamsNote}>{t('group.teams.unavailable')}</div>
      ) : null}
      <div className={css.stage}>
        <svg
          className={css.svg}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={t('view.canvas')}
        >
          <defs>
            <marker
              id="agent-canvas-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#5a6478" />
            </marker>
          </defs>
          {layout.groups.map(group => (
            <g key={group.key}>
              <rect
                className={css.groupRect}
                x={group.x}
                y={group.y}
                width={group.width}
                height={group.height}
              />
              <text className={css.groupTitle} x={group.x + 14} y={group.y + 18}>
                {group.label}
              </text>
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
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => { openSession(node.id) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openSession(node.id)
                  }
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
                <text className={css.nodeTitle} x={12} y={20}>
                  {truncate(node.title, 18)}
                </text>
                <text className={css.nodeMeta} x={12} y={36}>
                  {t(`status.${node.status}`)}
                  {node.origin === 'subagent' ? ' · sub' : ''}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

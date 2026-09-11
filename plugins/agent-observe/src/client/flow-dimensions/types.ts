/**
 * Agent Flow dimension modules: shared context and view results.
 */

import type { SessionEventWindow, SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GraphDocument } from '@neuravoxel/aitopo'
import type { AgentFlowSnapshot } from '../derive-flow.ts'

/** Ordered Flow dimension ids (tab strip). */
export type FlowDimensionId =
  | 'process'
  | 'panorama'
  | 'loop'
  | 'seam'
  | 'events'

/** Cross-dimension selection hints (Session-scoped UI state). */
export interface FlowDimensionSelection {
  readonly nodeId: string | null
  readonly eventId: string | null
}

/** Inputs every dimension may read when deriving its view. */
export interface FlowDimensionContext {
  readonly sessionId: SessionId
  readonly focusTurn: number | null
  readonly window: SessionEventWindow
  readonly session: SessionSnapshot
  /** Pre-projected process topology (same source as today's Flow pane). */
  readonly agentFlow: AgentFlowSnapshot
  readonly selection: FlowDimensionSelection
  /** Locale lookup for labels that dimensions own. */
  readonly t: (key: string, params?: Record<string, string>) => string
}

/** Per-node inspector payload for graph dimensions. */
export interface FlowNodeInspect {
  readonly inputText?: string
  readonly outputText?: string
  readonly detail?: string
}

/** AITopo-hosted dimension. */
export interface GraphDimensionView {
  readonly kind: 'graph'
  readonly document: GraphDocument
  readonly inspectByNodeId?: ReadonlyMap<string, FlowNodeInspect>
  /** When true, empty canvas double-click returns to Fleet. */
  readonly blankDoubleClickToFleet: true
  /** Which legend strip FlowPane should render. */
  readonly legend: 'process' | 'status'
}

/** Dual-pane SessionEvent dimension. */
export interface EventsDimensionView {
  readonly kind: 'events'
  readonly entries: readonly EventListEntry[]
  readonly selected: EventListEntry | null
  readonly linkedNodeId?: string
  readonly filter: EventListFilter
  readonly blankDoubleClickToFleet: false
}

/** One row in the events timeline. */
export interface EventListEntry {
  readonly id: string
  readonly seq: number
  readonly type: string
  readonly turn: number | null
  readonly step: number | null
  readonly summary: string
  readonly payloadText: string
  /** Optional process/skeleton node id this event maps to. */
  readonly linkedNodeId?: string
}

/** Coarse event list filter chips. */
export type EventListFilter = 'all' | 'surface' | 'control'

export type FlowDimensionView = GraphDimensionView | EventsDimensionView

/** One registered Flow dimension. */
export interface FlowDimensionModule {
  readonly id: FlowDimensionId
  readonly labelKey: string
  readonly derive: (ctx: FlowDimensionContext) => FlowDimensionView
}

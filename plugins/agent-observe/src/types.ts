/**
 * Shared Agent Observe topology vocabulary (Host snapshot + Client derivation).
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

/**
 * How a node is currently executing on the Host (or Client approximation).
 *
 * - `running` — live Agent mid-turn
 * - `idle` — live Agent attached, not mid-turn
 * - `cold` — Session without a live Agent (Host), or Client cannot tell
 * - `archived` — in the workspace archive set (Client; not an Agent lifecycle)
 */
export type AgentNodeStatus = 'running' | 'idle' | 'cold' | 'archived'

/** Layout grouping mode for the Canvas. */
export type AgentObserveGroupMode = 'workspace' | 'tree' | 'teams'

/** One Session / Agent identity on the canvas. */
export interface AgentObserveNode {
  readonly id: SessionId
  readonly title: string
  readonly status: AgentNodeStatus
  readonly cwd?: string
  readonly parentId?: SessionId
  readonly origin?: 'subagent'
  readonly blank: boolean
  /** Workspace id when membership is known; absent for ungrouped. */
  readonly workspaceId?: string
  /** Optional Agent Teams membership label when Teams is composed. */
  readonly teamId?: string
}

/** Directed edge between two Session ids. */
export interface AgentObserveEdge {
  readonly from: SessionId
  readonly to: SessionId
  readonly kind: 'parent' | 'team'
}

/** Point-in-time topology used by Host service and Client views. */
export interface AgentObserveSnapshot {
  readonly nodes: readonly AgentObserveNode[]
  readonly edges: readonly AgentObserveEdge[]
  /** ISO time the snapshot was built. */
  readonly updatedAt: string
}

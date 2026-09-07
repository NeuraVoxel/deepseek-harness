/**
 * Shared Agent Canvas topology vocabulary (Host snapshot + Client derivation).
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** How a node is currently executing on the Host (or Client approximation). */
export type AgentNodeStatus = 'running' | 'idle' | 'cold'

/** Layout grouping mode for the Canvas. */
export type AgentCanvasGroupMode = 'workspace' | 'tree' | 'teams'

/** One Session / Agent identity on the canvas. */
export interface AgentCanvasNode {
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
export interface AgentCanvasEdge {
  readonly from: SessionId
  readonly to: SessionId
  readonly kind: 'parent' | 'team'
}

/** Point-in-time topology used by Host service and Client views. */
export interface AgentCanvasSnapshot {
  readonly nodes: readonly AgentCanvasNode[]
  readonly edges: readonly AgentCanvasEdge[]
  /** ISO time the snapshot was built. */
  readonly updatedAt: string
}

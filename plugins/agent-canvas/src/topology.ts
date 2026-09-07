/**
 * Build an Agent Canvas snapshot from live Host registries.
 *
 * Uses `ctx.get` rather than typed `ctx.sessions` / `ctx.agents` so this Host
 * module can share a Client tsconfig without colliding Context merges.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AgentCanvasEdge, AgentCanvasNode, AgentCanvasSnapshot } from './types.ts'

interface HostSessionHeader {
  readonly cwd?: string
  readonly parentSession?: SessionId
  readonly origin?: 'subagent'
}

interface HostSession {
  readonly id: SessionId
  readonly seq: number
  readonly header: HostSessionHeader
}

interface HostAgent {
  readonly id: SessionId
  readonly status: 'idle' | 'running'
}

interface HostSessionStore {
  list(): readonly HostSession[]
}

interface HostAgentRegistry {
  get(id: SessionId): HostAgent | undefined
  list(): readonly HostAgent[]
}

/**
 * Project every attached Session plus live Agent status into a canvas snapshot.
 * @param ctx - Host context with sessions and agents services.
 * @returns topology snapshot.
 */
export function buildLiveTopology(ctx: Context): AgentCanvasSnapshot {
  const sessions = ctx.get('sessions') as HostSessionStore | undefined
  const agents = ctx.get('agents') as HostAgentRegistry | undefined
  if (sessions === undefined || agents === undefined) {
    return { nodes: [], edges: [], updatedAt: new Date().toISOString() }
  }

  const nodes: AgentCanvasNode[] = []
  const edges: AgentCanvasEdge[] = []
  const seen = new Set<string>()

  for (const session of sessions.list()) {
    const id = session.id
    seen.add(id)
    const agent = agents.get(id)
    const status = agent === undefined
      ? 'cold' as const
      : agent.status === 'running' ? 'running' as const : 'idle' as const
    const parentId = session.header.parentSession
    nodes.push({
      id,
      title: String(id),
      status,
      ...(session.header.cwd === undefined ? {} : { cwd: session.header.cwd }),
      ...(parentId === undefined ? {} : { parentId }),
      ...(session.header.origin === undefined ? {} : { origin: session.header.origin }),
      blank: session.seq === 0,
    })
    if (parentId !== undefined) {
      edges.push({ from: parentId, to: id, kind: 'parent' })
    }
  }

  for (const agent of agents.list()) {
    if (seen.has(agent.id)) continue
    nodes.push({
      id: agent.id,
      title: String(agent.id),
      status: agent.status === 'running' ? 'running' : 'idle',
      blank: false,
    })
  }

  return { nodes, edges, updatedAt: new Date().toISOString() }
}

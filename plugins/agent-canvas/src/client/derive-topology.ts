/**
 * Derive a Client-side Agent Canvas snapshot from session + workspace lists.
 *
 * Without a Host Remote, `running` is exact and everything else is `idle`
 * (cold Sessions cannot be distinguished from idle live Agents).
 */

import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  AgentCanvasEdge, AgentCanvasNode, AgentCanvasSnapshot,
} from '../types.ts'

/**
 * @param sessions - Client session list snapshot.
 * @param workspaces - Client workspace snapshot.
 * @returns topology for the Canvas view.
 */
export function deriveClientTopology(
  sessions: SessionListState,
  workspaces: WorkspaceSnapshot,
): AgentCanvasSnapshot {
  const workspaceBySession = new Map<string, string>()
  for (const workspace of workspaces.items) {
    for (const sessionId of workspace.sessionIds) {
      workspaceBySession.set(sessionId, workspace.workspaceId)
    }
  }

  const nodes: AgentCanvasNode[] = []
  const edges: AgentCanvasEdge[] = []

  for (const id of sessions.ids) {
    const row: SessionSummary | undefined = sessions.byId[id]
    if (row === undefined) continue
    const parentId = row.parentId
    const workspaceId = workspaceBySession.get(id)
      ?? matchWorkspaceByCwd(workspaces, row.cwd)
    nodes.push({
      id,
      title: row.displayTitle,
      status: row.running ? 'running' : 'idle',
      ...(row.cwd === undefined ? {} : { cwd: row.cwd }),
      ...(parentId === undefined ? {} : { parentId }),
      ...(row.origin === undefined ? {} : { origin: row.origin }),
      blank: row.blank,
      ...(workspaceId === undefined ? {} : { workspaceId }),
    })
    if (parentId !== undefined) {
      edges.push({ from: parentId, to: id as SessionId, kind: 'parent' })
    }
  }

  return { nodes, edges, updatedAt: new Date().toISOString() }
}

function matchWorkspaceByCwd(
  workspaces: WorkspaceSnapshot,
  cwd: string | undefined,
): string | undefined {
  if (cwd === undefined) return undefined
  for (const workspace of workspaces.items) {
    if (workspace.path === cwd) return workspace.workspaceId
  }
  return undefined
}

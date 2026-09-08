/**
 * Pure layout helpers for the Agent Observe fleet (positions feed AITopo documents).
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AgentObserveGroupMode, AgentObserveNode, AgentObserveSnapshot } from '../types.ts'

/** One laid-out node with canvas coordinates. */
export interface LaidOutNode extends AgentObserveNode {
  readonly x: number
  readonly y: number
  readonly groupKey: string
  readonly groupLabel: string
}

/** One group band for drawing labels / backgrounds. */
export interface LayoutGroup {
  readonly key: string
  readonly label: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Complete layout for one snapshot + group mode. */
export interface CanvasLayout {
  readonly nodes: readonly LaidOutNode[]
  readonly groups: readonly LayoutGroup[]
  readonly width: number
  readonly height: number
}

const NODE_W = 160
const NODE_H = 48
const GAP_X = 32
const GAP_Y = 28
const PAD = 24
const GROUP_PAD = 16
const HEADER = 28

/**
 * Place nodes in columns per group.
 * @param snapshot - topology.
 * @param mode - grouping mode.
 * @param labels - resolved group labels (ungrouped / workspace titles).
 * @returns layout geometry.
 */
export function layoutTopology(
  snapshot: AgentObserveSnapshot,
  mode: AgentObserveGroupMode,
  labels: { ungrouped: string; workspaceTitle: (id: string) => string },
): CanvasLayout {
  const byId = new Map(snapshot.nodes.map(node => [node.id as string, node]))
  const buckets = new Map<string, AgentObserveNode[]>()
  for (const node of snapshot.nodes) {
    const key = groupKeyFor(node, mode, byId)
    const list = buckets.get(key)
    if (list === undefined) buckets.set(key, [node])
    else list.push(node)
  }

  const groupKeys = [...buckets.keys()].sort((a, b) => {
    if (a === '__ungrouped__') return 1
    if (b === '__ungrouped__') return -1
    return a.localeCompare(b)
  })

  const groups: LayoutGroup[] = []
  const laid: LaidOutNode[] = []
  let cursorX = PAD

  for (const key of groupKeys) {
    const members = buckets.get(key) ?? []
    const cols = Math.max(1, Math.ceil(Math.sqrt(members.length)))
    const rows = Math.ceil(members.length / cols)
    const innerW = cols * NODE_W + (cols - 1) * GAP_X
    const innerH = rows * NODE_H + (rows - 1) * GAP_Y
    const width = innerW + GROUP_PAD * 2
    const height = HEADER + innerH + GROUP_PAD * 2
    const rootTitle = byId.get(key)?.title
    const label = key === '__ungrouped__'
      ? labels.ungrouped
      : mode === 'workspace' ? labels.workspaceTitle(key)
        : mode === 'tree' ? (rootTitle ?? key)
          : key

    groups.push({ key, label, x: cursorX, y: PAD, width, height })

    members.forEach((node, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      laid.push({
        ...node,
        groupKey: key,
        groupLabel: label,
        x: cursorX + GROUP_PAD + col * (NODE_W + GAP_X),
        y: PAD + HEADER + GROUP_PAD + row * (NODE_H + GAP_Y),
      })
    })

    cursorX += width + GAP_X
  }

  const width = Math.max(PAD * 2 + NODE_W, cursorX)
  const height = Math.max(
    PAD * 2 + NODE_H,
    PAD + Math.max(0, ...groups.map(group => group.height)) + PAD,
  )
  return { nodes: laid, groups, width, height }
}

/**
 * @param node - canvas node.
 * @param mode - grouping mode.
 * @param byId - id → node map for tree root walks.
 * @returns bucket key.
 */
export function groupKeyFor(
  node: AgentObserveNode,
  mode: AgentObserveGroupMode,
  byId: ReadonlyMap<string, AgentObserveNode>,
): string {
  switch (mode) {
    case 'workspace':
      return node.workspaceId ?? '__ungrouped__'
    case 'tree':
      return treeRootId(node, byId)
    case 'teams':
      return node.teamId ?? '__ungrouped__'
  }
}

function treeRootId(
  node: AgentObserveNode,
  byId: ReadonlyMap<string, AgentObserveNode>,
): string {
  let current: AgentObserveNode | undefined = node
  const seen = new Set<string>()
  while (current?.parentId !== undefined && !seen.has(current.id)) {
    seen.add(current.id)
    const parent: AgentObserveNode | undefined = byId.get(current.parentId as string)
    if (parent === undefined) return current.parentId as string
    current = parent
  }
  return (current?.id ?? node.id) as string
}

export const NODE_SIZE = { width: NODE_W, height: NODE_H } as const

/** @param id - session id used as a map key. */
export function asSessionKey(id: SessionId): string {
  return id
}

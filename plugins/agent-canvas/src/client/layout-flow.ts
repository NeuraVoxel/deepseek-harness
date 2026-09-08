/**
 * Client / Host banded layout for an Agent process flow graph.
 * Sibling tools in one Host step stack in a vertical parallel column.
 * Envelope (Host · Frame) and Context (Host · Step) share one vertical center spine.
 */

import type { AgentFlowEdge, AgentFlowNode, AgentFlowSnapshot } from './derive-flow.ts'

/** Laid-out flow node with top-left (rects) or center (tools) coordinates. */
export interface LaidOutFlowNode extends AgentFlowNode {
  readonly x: number
  readonly y: number
  /** Circle radius when kind === 'tool'; otherwise undefined. */
  readonly radius?: number
  readonly width: number
  readonly height: number
}

/** One Client / Host / Step band. */
export interface FlowStepGroup {
  readonly key: string
  readonly label: string
  readonly step?: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** True when the band stacks 2+ sibling tools. */
  readonly parallelTools?: boolean
}

/** Complete flow layout. */
export interface FlowLayout {
  readonly nodes: readonly LaidOutFlowNode[]
  readonly edges: readonly AgentFlowEdge[]
  readonly groups: readonly FlowStepGroup[]
  readonly width: number
  readonly height: number
}

const RECT_W = 148
const RECT_H = 56
const TOOL_R = 28
const GAP_X = 40
const GAP_Y = 16
const PAD = 28
const GROUP_PAD = 16
const HEADER = 26
const BAND_GAP = 28

interface BandPlan {
  readonly key: string
  readonly label: string
  readonly step?: number
  readonly members: readonly AgentFlowNode[]
  readonly columns: readonly AgentFlowNode[][]
  readonly colSizes: readonly { width: number; height: number }[]
  readonly colLefts: readonly number[]
  readonly innerW: number
  readonly innerH: number
  readonly width: number
  readonly height: number
  /** Center X of the alignment target within band content (x=0 at first column left). */
  readonly alignCenterLocal: number
}

/**
 * Place nodes in Client / Host bands; tools share a vertical parallel column.
 * Envelope and Context centers share one vertical spine; other bands center on that spine.
 * @param snapshot - flow snapshot.
 * @returns layout geometry.
 */
export function layoutAgentFlow(snapshot: AgentFlowSnapshot): FlowLayout {
  if (snapshot.nodes.length === 0) {
    return { nodes: [], edges: snapshot.edges, groups: [], width: PAD * 2, height: PAD * 2 }
  }

  const clientNodes = [
    ...snapshot.nodes.filter(n => n.kind === 'client-input'),
    ...snapshot.nodes.filter(n => n.kind === 'remote-prompt'),
    ...snapshot.nodes.filter(n => n.kind === 'remote-follow'),
    ...snapshot.nodes.filter(n => n.kind === 'client-render'),
  ]
  const hostFrame = snapshot.nodes.filter(n =>
    n.kind === 'profile' || n.kind === 'session' || n.kind === 'envelope' || n.kind === 'host-admit')
  const stepNums = [...new Set(
    snapshot.nodes.filter(n => n.step !== undefined).map(n => n.step!),
  )].sort((a, b) => a - b)

  const plans: BandPlan[] = []
  // Client band owns both Input and Render — Host sits between them in the loop.
  if (clientNodes.length > 0) {
    const surface = snapshot.clientSurface === 'cli' ? 'CLI' : 'Web'
    plans.push(planBand(
      'client',
      `Client · ${surface}`,
      orderBand(clientNodes),
      undefined,
      'center',
    ))
  }
  if (hostFrame.length > 0) {
    const parts = ['Host · Frame']
    if (snapshot.turn !== null && snapshot.turn > 0) parts.push(`Turn ${snapshot.turn}`)
    if (snapshot.agentPreset !== undefined && snapshot.agentPreset !== '') {
      parts.push(snapshot.agentPreset)
    }
    plans.push(planBand('host-frame', parts.join(' · '), orderBand(hostFrame), undefined, 'envelope'))
  }
  for (const step of stepNums) {
    const members = orderBand(snapshot.nodes.filter(n => n.step === step))
    const label = step === 0 ? 'Host · Step …' : `Host · Step ${step}`
    plans.push(planBand(`step:${step}`, label, members, step, 'context'))
  }

  // Spine X = shared center of Envelope / Context (fallback: content midpoints).
  const spineX = Math.max(
    ...plans.map(plan => PAD + GROUP_PAD + plan.alignCenterLocal),
    PAD + GROUP_PAD + RECT_W / 2,
  )

  const groups: FlowStepGroup[] = []
  const laid: LaidOutFlowNode[] = []
  let cursorY = PAD
  let maxRight = PAD * 2

  for (const plan of plans) {
    const contentLeft = spineX - plan.alignCenterLocal
    const groupX = contentLeft - GROUP_PAD
    const groupY = cursorY
    const parallelTools = plan.columns.some(col => col.length > 1 && col.every(n => n.kind === 'tool'))

    groups.push({
      key: plan.key,
      label: parallelTools ? `${plan.label} · parallel` : plan.label,
      ...(plan.step === undefined ? {} : { step: plan.step }),
      x: groupX,
      y: groupY,
      width: plan.width,
      height: plan.height,
      ...(parallelTools ? { parallelTools: true } : {}),
    })

    plan.columns.forEach((col, colIndex) => {
      const size = plan.colSizes[colIndex]!
      const left = contentLeft + plan.colLefts[colIndex]!
      const top = groupY + HEADER + GROUP_PAD + (plan.innerH - size.height) / 2
      placeColumn(laid, col, left, top)
    })

    maxRight = Math.max(maxRight, groupX + plan.width + PAD)
    cursorY += plan.height + BAND_GAP
  }

  return {
    nodes: laid,
    edges: snapshot.edges,
    groups,
    width: maxRight,
    height: cursorY - BAND_GAP + PAD,
  }
}

/**
 * Split a band into left-to-right columns; consecutive tools share one column.
 * @param members - ordered band members.
 */
export function buildColumns(members: readonly AgentFlowNode[]): AgentFlowNode[][] {
  const columns: AgentFlowNode[][] = []
  for (const node of members) {
    const last = columns[columns.length - 1]
    if (node.kind === 'tool' && last !== undefined && last.every(n => n.kind === 'tool')) {
      last.push(node)
    } else {
      columns.push([node])
    }
  }
  return columns
}

function planBand(
  key: string,
  label: string,
  members: readonly AgentFlowNode[],
  step: number | undefined,
  align: 'envelope' | 'context' | 'center',
): BandPlan {
  const columns = buildColumns(members)
  const colSizes = columns.map(col => columnSize(col))
  const colLefts: number[] = []
  let x = 0
  for (let i = 0; i < colSizes.length; i += 1) {
    colLefts.push(x)
    x += colSizes[i]!.width + (i < colSizes.length - 1 ? GAP_X : 0)
  }
  const innerW = colSizes.reduce((sum, size, index) =>
    sum + size.width + (index > 0 ? GAP_X : 0), 0)
  const innerH = Math.max(...colSizes.map(size => size.height), RECT_H)
  const alignCenterLocal = columnCenterLocal(columns, colSizes, colLefts, align, innerW)
  return {
    key,
    label,
    ...(step === undefined ? {} : { step }),
    members,
    columns,
    colSizes,
    colLefts,
    innerW,
    innerH,
    width: innerW + GROUP_PAD * 2,
    height: HEADER + innerH + GROUP_PAD * 2,
    alignCenterLocal,
  }
}

/**
 * Local center X used to pin the band onto the Envelope/Context spine.
 * @param align - `envelope` / `context` prefer that kind's column; else content midpoint.
 */
function columnCenterLocal(
  columns: readonly AgentFlowNode[][],
  colSizes: readonly { width: number; height: number }[],
  colLefts: readonly number[],
  align: 'envelope' | 'context' | 'center',
  innerW: number,
): number {
  if (align === 'center') return innerW / 2
  const kind = align
  const index = columns.findIndex(col => col.some(n => n.kind === kind))
  if (index < 0) return innerW / 2
  return colLefts[index]! + colSizes[index]!.width / 2
}

function columnSize(col: readonly AgentFlowNode[]): { width: number; height: number } {
  const sizes = col.map(nodeSize)
  return {
    width: Math.max(...sizes.map(s => s.width)),
    height: sizes.reduce((sum, size, index) =>
      sum + size.height + (index > 0 ? GAP_Y : 0), 0),
  }
}

function placeColumn(
  laid: LaidOutFlowNode[],
  col: readonly AgentFlowNode[],
  left: number,
  top: number,
): void {
  let y = top
  const colW = Math.max(...col.map(n => nodeSize(n).width))
  for (const node of col) {
    const size = nodeSize(node)
    const x = left + (colW - size.width) / 2
    if (node.kind === 'tool') {
      laid.push({
        ...node,
        x: x + size.width / 2,
        y: y + size.height / 2,
        radius: TOOL_R,
        width: size.width,
        height: size.height,
      })
    } else {
      laid.push({
        ...node,
        x,
        y,
        width: size.width,
        height: size.height,
      })
    }
    y += size.height + GAP_Y
  }
}

function orderBand(nodes: readonly AgentFlowNode[]): AgentFlowNode[] {
  const order: Record<string, number> = {
    'client-input': 0,
    'remote-prompt': 1,
    'remote-follow': 2,
    'client-render': 3,
    profile: 10,
    session: 11,
    envelope: 12,
    'host-admit': 13,
    memory: 20,
    context: 21,
    model: 22,
    tool: 23,
    join: 24,
  }
  return [...nodes].sort((a, b) => {
    const kindDelta = (order[a.kind] ?? 50) - (order[b.kind] ?? 50)
    if (kindDelta !== 0) return kindDelta
    return a.id.localeCompare(b.id)
  })
}

function nodeSize(node: AgentFlowNode): { width: number; height: number } {
  if (node.kind === 'tool') return { width: TOOL_R * 2, height: TOOL_R * 2 }
  return { width: RECT_W, height: RECT_H }
}

/**
 * Anchor point for edge endpoints.
 * @param node - laid-out node.
 * @param side - which side of the node.
 */
export function flowAnchor(
  node: LaidOutFlowNode,
  side: 'left' | 'right' | 'center',
): { x: number; y: number } {
  if (node.kind === 'tool' && node.radius !== undefined) {
    if (side === 'left') return { x: node.x - node.radius, y: node.y }
    if (side === 'right') return { x: node.x + node.radius, y: node.y }
    return { x: node.x, y: node.y }
  }
  if (side === 'left') return { x: node.x, y: node.y + node.height / 2 }
  if (side === 'right') return { x: node.x + node.width, y: node.y + node.height / 2 }
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
}

export const FLOW_NODE_SIZE = { width: RECT_W, height: RECT_H } as const
export const FLOW_TOOL_RADIUS = TOOL_R

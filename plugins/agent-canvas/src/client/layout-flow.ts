/**
 * Step-grouped layout for an Agent process flow graph.
 * Tools render as circles; other kinds as rectangles.
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

/** One step (or prelude/epilogue) band. */
export interface FlowStepGroup {
  readonly key: string
  readonly label: string
  readonly step?: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
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
const PAD = 28
const GROUP_PAD = 16
const HEADER = 26
const BAND_GAP = 28

/**
 * Place nodes in horizontal step bands (prelude → each step → epilogue).
 * @param snapshot - flow snapshot.
 * @returns layout geometry.
 */
export function layoutAgentFlow(snapshot: AgentFlowSnapshot): FlowLayout {
  if (snapshot.nodes.length === 0) {
    return { nodes: [], edges: snapshot.edges, groups: [], width: PAD * 2, height: PAD * 2 }
  }

  const prelude = snapshot.nodes.filter(n => n.step === undefined
    && n.kind !== 'turn-end' && n.kind !== 'client-render')
  const epilogue = snapshot.nodes.filter(n => n.kind === 'turn-end' || n.kind === 'client-render')
  const stepNums = [...new Set(
    snapshot.nodes.filter(n => n.step !== undefined).map(n => n.step!),
  )].sort((a, b) => a - b)

  const bands: { key: string; label: string; step?: number; members: AgentFlowNode[] }[] = []
  if (prelude.length > 0) {
    bands.push({ key: 'prelude', label: 'Client → Host', members: orderBand(prelude) })
  }
  for (const step of stepNums) {
    const members = orderBand(snapshot.nodes.filter(n => n.step === step))
    bands.push({ key: `step:${step}`, label: `Step ${step}`, step, members })
  }
  if (epilogue.length > 0) {
    bands.push({ key: 'epilogue', label: 'Settle', members: orderBand(epilogue) })
  }

  const groups: FlowStepGroup[] = []
  const laid: LaidOutFlowNode[] = []
  let cursorY = PAD
  let maxWidth = PAD * 2

  for (const band of bands) {
    const sizes = band.members.map(nodeSize)
    const innerW = sizes.reduce((sum, size, index) =>
      sum + size.width + (index > 0 ? GAP_X : 0), 0)
    const innerH = Math.max(...sizes.map(size => size.height), RECT_H)
    const width = innerW + GROUP_PAD * 2
    const height = HEADER + innerH + GROUP_PAD * 2
    const groupX = PAD
    const groupY = cursorY

    groups.push({
      key: band.key,
      label: band.label,
      ...(band.step === undefined ? {} : { step: band.step }),
      x: groupX,
      y: groupY,
      width,
      height,
    })

    let cursorX = groupX + GROUP_PAD
    band.members.forEach((node, index) => {
      const size = sizes[index]!
      const y = groupY + HEADER + GROUP_PAD + (innerH - size.height) / 2
      if (node.kind === 'tool') {
        laid.push({
          ...node,
          x: cursorX + size.width / 2,
          y: y + size.height / 2,
          radius: TOOL_R,
          width: size.width,
          height: size.height,
        })
      } else {
        laid.push({
          ...node,
          x: cursorX,
          y,
          width: size.width,
          height: size.height,
        })
      }
      cursorX += size.width + GAP_X
    })

    maxWidth = Math.max(maxWidth, groupX + width + PAD)
    cursorY += height + BAND_GAP
  }

  return {
    nodes: laid,
    edges: snapshot.edges,
    groups,
    width: maxWidth,
    height: cursorY - BAND_GAP + PAD,
  }
}

function orderBand(nodes: readonly AgentFlowNode[]): AgentFlowNode[] {
  const order: Record<string, number> = {
    'client-input': 0,
    'host-admit': 1,
    step: 2,
    model: 3,
    tool: 4,
    'turn-end': 5,
    'client-render': 6,
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

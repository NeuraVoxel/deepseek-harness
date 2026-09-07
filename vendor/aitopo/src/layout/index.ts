/**
 * Built-in layouts writing node coordinates.
 */

import type { GraphDocument } from '../protocol/types.ts'
import { DEFAULT_H, DEFAULT_W } from '../ui/bounds.ts'

const GAP_X = 32
const GAP_Y = 28
const PAD = 24
const GROUP_PAD = 16
const HEADER = 28

/**
 * Place nodes in columns per group (or one bucket).
 * @param doc - document.
 * @returns id → position map.
 */
export function layoutGrid(doc: GraphDocument): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const groups = doc.groups ?? []
  if (groups.length === 0) {
    placeBucket(doc.nodes.map(n => n.id), PAD, PAD, positions)
    return positions
  }
  let cursorX = PAD
  for (const group of groups) {
    const members = group.memberIds.length > 0
      ? group.memberIds
      : doc.nodes.filter(n => n.groupId === group.id).map(n => n.id)
    placeBucket(members, cursorX + GROUP_PAD, PAD + HEADER + GROUP_PAD, positions)
    const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, members.length))))
    const rows = Math.ceil(Math.max(1, members.length) / cols)
    const width = cols * DEFAULT_W + (cols - 1) * GAP_X + GROUP_PAD * 2
    void rows
    cursorX += width + GAP_X
  }
  // Ungrouped nodes
  const grouped = new Set(groups.flatMap(g => [...g.memberIds]))
  const rest = doc.nodes.filter(n => !grouped.has(n.id) && n.groupId === undefined).map(n => n.id)
  if (rest.length > 0) placeBucket(rest, cursorX + GROUP_PAD, PAD + HEADER + GROUP_PAD, positions)
  return positions
}

/**
 * Left-to-right columns by `data.column` or node order.
 * @param doc - document.
 */
export function layoutFlowColumns(doc: GraphDocument): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const columns = new Map<number, string[]>()
  doc.nodes.forEach((node, index) => {
    const col = typeof node.data?.column === 'number' ? node.data.column : index
    const list = columns.get(col)
    if (list === undefined) columns.set(col, [node.id])
    else list.push(node.id)
  })
  const sortedCols = [...columns.keys()].sort((a, b) => a - b)
  sortedCols.forEach((col, colIndex) => {
    const members = columns.get(col) ?? []
    members.forEach((id, row) => {
      positions[id] = {
        x: PAD + colIndex * (DEFAULT_W + GAP_X * 2),
        y: PAD + row * (DEFAULT_H + GAP_Y),
      }
    })
  })
  return positions
}

function placeBucket(
  ids: readonly string[],
  originX: number,
  originY: number,
  positions: Record<string, { x: number; y: number }>,
): void {
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, ids.length))))
  ids.forEach((id, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    positions[id] = {
      x: originX + col * (DEFAULT_W + GAP_X),
      y: originY + row * (DEFAULT_H + GAP_Y),
    }
  })
}

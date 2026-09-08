/**
 * Project an OrchestrationDocument to an AITopo GraphDocument.
 */

import type { GraphDocument, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import type { OrchestrationDocument, OrchestrationUnit } from './types.ts'

const NODE_W = 200
const NODE_H = 48
const COL_GAP = 24
const ROW_GAP = 16
const ORIGIN_X = 40
const ORIGIN_Y = 48

/** Labels the adapter needs from the Client locale layer. */
export interface OrchestrationGraphLabels {
  readonly compositionGroup: string
  readonly empty: string
  readonly broken: string
}

/**
 * Grid-layout positions for composition units (column-major).
 * @param units - composition units.
 * @param columns - column count.
 * @returns id → coordinates.
 */
export function layoutComposition(
  units: readonly OrchestrationUnit[],
  columns = 2,
): Readonly<Record<string, { readonly x: number; readonly y: number }>> {
  const positions: Record<string, { x: number; y: number }> = {}
  units.forEach((unit, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    positions[unit.id] = {
      x: ORIGIN_X + col * (NODE_W + COL_GAP),
      y: ORIGIN_Y + row * (NODE_H + ROW_GAP),
    }
  })
  return positions
}

/**
 * Map enablement to a node status string for AITopo styling.
 * @param enabled - unit enablement.
 * @returns status token.
 */
export function statusForEnablement(enabled: OrchestrationUnit['enabled']): string {
  if (enabled === true) return 'active'
  if (enabled === 'conditional') return 'pending'
  return 'idle'
}

/**
 * Convert an orchestration document into a loadable GraphDocument.
 * @param document - authoritative orchestration document.
 * @param labels - localized group / empty strings.
 * @returns GraphDocument for Network.load.
 */
export function toGraphDocument(
  document: OrchestrationDocument,
  labels: OrchestrationGraphLabels,
): GraphDocument {
  if (document.meta.broken !== undefined) {
    return {
      version: 1,
      meta: {
        title: document.meta.title ?? document.meta.target,
        kind: 'custom',
        orchestrationKind: document.meta.kind,
        target: document.meta.target,
      },
      nodes: [{
        id: 'broken',
        type: 'note',
        label: labels.broken,
        x: ORIGIN_X,
        y: ORIGIN_Y,
        w: NODE_W * 2,
        h: NODE_H,
        status: 'error',
        data: { message: document.meta.broken },
      }],
      edges: [],
      groups: [],
    }
  }

  if (document.composition.length === 0) {
    return {
      version: 1,
      meta: {
        title: document.meta.title ?? document.meta.target,
        kind: 'custom',
        orchestrationKind: document.meta.kind,
        target: document.meta.target,
      },
      nodes: [{
        id: 'empty',
        type: 'note',
        label: labels.empty,
        x: ORIGIN_X,
        y: ORIGIN_Y,
        w: NODE_W * 2,
        h: NODE_H,
        status: 'idle',
      }],
      edges: [],
      groups: [],
    }
  }

  const positions = document.layout?.positions ?? layoutComposition(document.composition)
  const nodes: GraphNode[] = document.composition.map(unit => {
    const pos = positions[unit.id] ?? { x: ORIGIN_X, y: ORIGIN_Y }
    return {
      id: unit.id,
      type: 'composition-unit',
      label: unit.label,
      status: statusForEnablement(unit.enabled),
      x: pos.x,
      y: pos.y,
      w: NODE_W,
      h: NODE_H,
      groupId: 'composition',
      data: {
        moduleName: unit.moduleName,
        enabled: unit.enabled,
        locked: unit.locked,
        ...(unit.condition !== undefined ? { condition: unit.condition } : {}),
      },
    }
  })

  const groups: GraphGroup[] = [{
    id: 'composition',
    label: labels.compositionGroup,
    memberIds: nodes.map(node => node.id),
  }]

  return {
    version: 1,
    meta: {
      title: document.meta.title ?? document.meta.target,
      kind: 'custom',
      orchestrationKind: document.meta.kind,
      target: document.meta.target,
      trust: document.meta.trust,
      isDefault: document.meta.isDefault,
    },
    nodes,
    edges: [],
    groups,
  }
}

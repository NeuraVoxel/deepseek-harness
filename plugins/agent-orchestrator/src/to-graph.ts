/**
 * Project an OrchestrationDocument to an AITopo GraphDocument.
 * Composition units are banded by wiki/011 architectural layers.
 */

import type { GraphDocument, GraphGroup, GraphNode } from '@neuravoxel/aitopo'
import {
  ARCHITECTURAL_LAYER_ORDER,
  type ArchitecturalLayerId,
} from './architectural-layer.ts'
import type { OrchestrationDocument, OrchestrationUnit } from './types.ts'

/** Flat card width — denser horizontal packing. */
const NODE_W = 168
/** Flat card height. */
const NODE_H = 36
const COL_GAP = 12
const ROW_GAP = 10
/** Left inset for the first column of every layer band. */
const ORIGIN_X = 24
/** Top inset before the first layer band. */
const ORIGIN_Y = 28
/** Vertical gap between consecutive layer bands (tight for a flat canvas). */
const LAYER_GAP = 14
/** Padding around member nodes for the group band (AITopo does not union members). */
const GROUP_PAD = 8
/** Space above the first row for the group label. */
const GROUP_HEADER = 18
/** Default columns for a wide, flat composition grid. */
const DEFAULT_COLUMNS = 4

/** AITopo paint overrides carried on node.data. */
export interface NodePaintStyle {
  readonly fill: string
  readonly stroke: string
  readonly labelColor: string
  readonly metaColor: string
}

/** Labels the adapter needs from the Client locale layer. */
export interface OrchestrationGraphLabels {
  /** Localized title for each architectural layer band. */
  readonly layerGroup: (layer: ArchitecturalLayerId) => string
  readonly empty: string
  readonly broken: string
}

/**
 * Grid-layout positions for composition units (column-major), optionally offset.
 * @param units - composition units (order preserved).
 * @param columns - column count.
 * @param originX - left origin for column 0.
 * @param originY - top origin for row 0.
 * @returns id → coordinates.
 */
export function layoutComposition(
  units: readonly OrchestrationUnit[],
  columns = DEFAULT_COLUMNS,
  originX = ORIGIN_X,
  originY = ORIGIN_Y,
): Readonly<Record<string, { readonly x: number; readonly y: number }>> {
  const positions: Record<string, { x: number; y: number }> = {}
  units.forEach((unit, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    positions[unit.id] = {
      x: originX + col * (NODE_W + COL_GAP),
      y: originY + row * (NODE_H + ROW_GAP),
    }
  })
  return positions
}

/**
 * Stack units into wiki-layer bands (top → bottom: other/⑨ → ①); empty layers omitted.
 * Caller order is preserved within each layer (composition before catalog when concatenated).
 * @param units - canvas units.
 * @param columns - column count inside each band.
 * @returns id → coordinates.
 */
export function layoutByArchitecturalLayer(
  units: readonly OrchestrationUnit[],
  columns = DEFAULT_COLUMNS,
): Readonly<Record<string, { readonly x: number; readonly y: number }>> {
  const byLayer = groupUnitsByLayer(units)
  const positions: Record<string, { x: number; y: number }> = {}
  let cursorY = ORIGIN_Y

  for (const layer of ARCHITECTURAL_LAYER_ORDER) {
    const members = byLayer.get(layer)
    if (members === undefined || members.length === 0) continue
    const band = layoutComposition(members, columns, ORIGIN_X, cursorY)
    Object.assign(positions, band)
    const rows = Math.ceil(members.length / columns)
    const bandHeight = rows * NODE_H + Math.max(0, rows - 1) * ROW_GAP
    cursorY += bandHeight + GROUP_HEADER + GROUP_PAD * 2 + LAYER_GAP
  }

  return positions
}

/**
 * Map enablement to a node status string for AITopo styling.
 * Enabled units intentionally avoid `active` — AITopo thickens that stroke.
 * @param enabled - unit enablement.
 * @returns status token.
 */
export function statusForEnablement(enabled: OrchestrationUnit['enabled']): string {
  if (enabled === true) return 'done'
  if (enabled === 'conditional') return 'pending'
  return 'idle'
}

/**
 * Flat enablement palette (paint via node.data).
 * 未加载退后 · 已加载默认可读 · 激活态见 live highlight（反白实心）.
 * @param enabled - unit enablement.
 * @returns fill / stroke / label colors.
 */
export function styleForEnablement(enabled: OrchestrationUnit['enabled']): NodePaintStyle {
  if (enabled === true) {
    return {
      fill: '#1F1F23',
      stroke: '#3F3F46',
      labelColor: '#E4E4E7',
      metaColor: '#A1A1AA',
    }
  }
  if (enabled === 'conditional') {
    return {
      fill: '#1C1C20',
      stroke: '#36363C',
      labelColor: '#D4D4D8',
      metaColor: '#71717A',
    }
  }
  return {
    fill: '#18181B',
    stroke: '#27272A',
    labelColor: '#52525B',
    metaColor: '#3F3F46',
  }
}

/**
 * Flat Host-catalog palette (muted vs composition enablement paint).
 * @param enabled - unit enablement.
 * @returns fill / stroke / label colors.
 */
export function styleForCatalog(enabled: OrchestrationUnit['enabled']): NodePaintStyle {
  if (enabled === true) {
    return {
      fill: '#141416',
      stroke: '#2A2A30',
      labelColor: '#71717A',
      metaColor: '#52525B',
    }
  }
  if (enabled === 'conditional') {
    return {
      fill: '#121214',
      stroke: '#25252A',
      labelColor: '#63636B',
      metaColor: '#3F3F46',
    }
  }
  return {
    fill: '#101012',
    stroke: '#1F1F23',
    labelColor: '#3F3F46',
    metaColor: '#27272A',
  }
}

/** Quiet second-line caption for enablement (avoids loud status tokens). */
export function metaForEnablement(enabled: OrchestrationUnit['enabled']): string {
  if (enabled === true) return 'on'
  if (enabled === 'conditional') return 'if'
  return 'off'
}

/** Canvas membership for a projected unit. */
export type GraphUnitMembership = 'composition' | 'catalog'

/**
 * Explicit band geometry wrapping laid-out nodes (required by AITopo paint).
 * @param nodes - composition unit nodes with x/y/w/h.
 * @returns group x/y/w/h.
 */
export function groupBandForNodes(
  nodes: readonly Pick<GraphNode, 'x' | 'y' | 'w' | 'h'>[],
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const w = node.w ?? NODE_W
    const h = node.h ?? NODE_H
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  const x = minX - GROUP_PAD
  const y = minY - GROUP_HEADER - GROUP_PAD
  return {
    x,
    y,
    w: maxX - minX + GROUP_PAD * 2,
    h: maxY - minY + GROUP_HEADER + GROUP_PAD * 2,
  }
}

/**
 * Convert an orchestration document into a loadable GraphDocument.
 * Projects composition and Host catalog into the same wiki/011 layer bands.
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
        data: {
          message: document.meta.broken,
          fill: '#3a1518',
          stroke: '#f07178',
          labelColor: '#f5d0d3',
          metaColor: '#c98a90',
        },
      }],
      edges: [],
      groups: [],
    }
  }

  if (document.composition.length === 0 && document.catalog.length === 0) {
    const idle = styleForEnablement(false)
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
        data: { ...idle },
      }],
      edges: [],
      groups: [],
    }
  }

  // Composition first, then catalog — layer grouping preserves that order within each band.
  const canvasUnits = [...document.composition, ...document.catalog]
  const positions = document.layout?.positions ?? layoutByArchitecturalLayer(canvasUnits)
  const byLayer = groupUnitsByLayer(canvasUnits)
  const membershipById = new Map<string, GraphUnitMembership>()
  for (const unit of document.composition) membershipById.set(unit.id, 'composition')
  for (const unit of document.catalog) membershipById.set(unit.id, 'catalog')
  const nodes: GraphNode[] = []
  const groups: GraphGroup[] = []

  for (const layer of ARCHITECTURAL_LAYER_ORDER) {
    const members = byLayer.get(layer)
    if (members === undefined || members.length === 0) continue
    const layerNodes: GraphNode[] = members.map(unit => {
      const pos = positions[unit.id] ?? { x: ORIGIN_X, y: ORIGIN_Y }
      const membership = membershipById.get(unit.id) ?? 'composition'
      const paint = membership === 'catalog'
        ? styleForCatalog(unit.enabled)
        : styleForEnablement(unit.enabled)
      return {
        id: unit.id,
        type: 'composition-unit',
        label: unit.label,
        status: statusForEnablement(unit.enabled),
        x: pos.x,
        y: pos.y,
        w: NODE_W,
        h: NODE_H,
        groupId: layerGroupId(layer),
        ...(unit.locked ? { locked: true } : {}),
        data: {
          entryId: unit.entryId,
          moduleName: unit.moduleName,
          enabled: unit.enabled,
          locked: unit.locked,
          layer: unit.layer,
          packageGroup: unit.packageGroup,
          membership,
          meta: membership === 'catalog' ? 'host' : metaForEnablement(unit.enabled),
          ...paint,
          ...(unit.condition !== undefined ? { condition: unit.condition } : {}),
          ...(unit.fiberPhase !== undefined ? { fiberPhase: unit.fiberPhase } : {}),
        },
      }
    })
    nodes.push(...layerNodes)
    groups.push({
      id: layerGroupId(layer),
      label: labels.layerGroup(layer),
      memberIds: layerNodes.map(node => node.id),
      ...groupBandForNodes(layerNodes),
    })
  }

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

function layerGroupId(layer: ArchitecturalLayerId): string {
  return `layer:${layer}`
}

function groupUnitsByLayer(
  units: readonly OrchestrationUnit[],
): Map<ArchitecturalLayerId, OrchestrationUnit[]> {
  const byLayer = new Map<ArchitecturalLayerId, OrchestrationUnit[]>()
  for (const unit of units) {
    const list = byLayer.get(unit.layer)
    if (list === undefined) byLayer.set(unit.layer, [unit])
    else list.push(unit)
  }
  return byLayer
}

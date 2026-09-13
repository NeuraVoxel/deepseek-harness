/**
 * Build an AITopo {@link GraphDocument} from a recorded dsh boot.
 *
 * Pure module: no I/O, no cordis imports. The driver (observe-boot.ts) owns
 * recording; this module owns the document vocabulary:
 *
 * - Root canvas: the launcher's boot phases as a flow (compose → prepare →
 *   mount → settle → ready), each node recolored by its duration bucket.
 *   Below the flow, one colored "layer portal" node per non-empty patch
 *   layer, each carrying a `networkId` — aitopo SubNetworks support exactly
 *   one drill level, so layer portals live on the ROOT and the per-layer
 *   plugin detail replaces the former group-band mount network.
 * - `network:compose`: one node per patch layer in application order — the
 *   composition view.
 * - `network:layer:<i>`: that layer's plugin nodes only. x encodes the
 *   per-layer activation order (row-wrapped); edges are observed fiber
 *   parent-child relations inside the layer; entries composed but never
 *   activated render `status: 'cold'` after the activated ones.
 * @module scripts/observe-boot-document
 */

import type { GraphDocument, GraphEdge, GraphNode } from '@neuravoxel/aitopo'

/** One observed loader fiber construction or disposal. */
export interface BootPluginEvent {
  /** Milliseconds since recording start. */
  atMs: number
  kind: 'construction' | 'disposal'
  fiberUid: number
  entryId: string
  entryName: string
  /** Declared `inject` requirements, normalized for display. */
  inject: string[]
  /** Entry options carry `disabled`; such rows never activate. */
  disabled: boolean
  /** Entry id of the parent fiber when the parent is itself an entry. */
  parentEntryId?: string
}

/** One launcher-level phase timing. */
export interface BootPhaseMark {
  id: 'compose' | 'prepare' | 'mount' | 'settle' | 'ready'
  label: string
  startedAtMs: number
  endedAtMs: number
  detail: string
}

/** One patch layer of the composed profile, in application order. */
export interface BootLayerInfo {
  name: string
  /** Entry ids this layer contributes or patches, in file order. */
  rowIds: string[]
}

/** The full recording handed to the document builder. */
export interface BootRecording {
  binName: string
  profile: string
  recordedAt: string
  phases: BootPhaseMark[]
  events: BootPluginEvent[]
  layers: BootLayerInfo[]
  /** Entry ids in the final tree that never constructed (disabled or inactive). */
  inactiveEntryIds: string[]
}

const COMPOSE_NETWORK_ID = 'network:compose'
const LAYER_NETWORK_PREFIX = 'network:layer:'
/** Lane for construction events whose entry id maps to no recorded layer. */
const UNATTRIBUTED_LAYER = '(unattributed)'
/** Plugin nodes per row inside a layer; keeps the fit-all view readable. */
const PLUGIN_COLUMNS = 16
/** Band palette: one hue per patch-layer lane; fill appends 8-digit hex alpha. */
const LANE_COLORS = [
  '#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
] as const
/** Portal grid on the root canvas. */
const PORTAL_COLUMNS = 3
/** Phase nodes recolor as a heat scale (dark hues keep the white icon legible). */
const PHASE_DURATION_BUCKETS = [
  { maxMs: 100, bucket: 'fast', color: '#2e7d32' },
  { maxMs: 1_000, bucket: 'moderate', color: '#9a6b00' },
  { maxMs: 5_000, bucket: 'slow', color: '#d84315' },
] as const

/** Phase nodes carry a `networkId` when that phase drills into a sub-network. */
const DRILL_NETWORK_BY_PHASE: Partial<Record<BootPhaseMark['id'], string>> = {
  compose: COMPOSE_NETWORK_ID,
}

function phaseDurationPaint(durationMs: number): { bucket: string; fill: string; stroke: string } {
  const found = PHASE_DURATION_BUCKETS.find(candidate => durationMs < candidate.maxMs)
  const color = found?.color ?? '#b71c1c'
  return { bucket: found?.bucket ?? 'critical', fill: color, stroke: color }
}

/**
 * Build the AITopo document for a boot recording.
 * @param recording - phases, plugin events, and patch-layer attribution.
 * @returns a `version: 1` GraphDocument (phase flow + layer portals on the
 * root, compose subnet, one subnet per non-empty layer).
 */
export function buildBootDocument(recording: BootRecording): GraphDocument {
  const constructions = recording.events.filter(event => event.kind === 'construction')

  const phaseNodes: GraphNode[] = recording.phases.map((phase, index) => {
    const drillNetworkId = DRILL_NETWORK_BY_PHASE[phase.id]
    const durationMs = Math.round(phase.endedAtMs - phase.startedAtMs)
    const paint = phaseDurationPaint(durationMs)
    return {
      id: `phase:${phase.id}`,
      type: 'phase',
      label: phase.label,
      label2: `${durationMs}ms`,
      tooltip: phase.detail,
      // Built-in icon keys: drillable phases read as sub-network portals.
      icon: drillNetworkId === undefined ? 'node' : 'router',
      x: 120 + index * 260,
      y: 120,
      // exactOptionalPropertyTypes: absent drill target omits the key entirely.
      ...(drillNetworkId === undefined ? {} : { networkId: drillNetworkId }),
      data: {
        phase: phase.id,
        durationMs,
        durationBucket: paint.bucket,
        // Body-color override consumed by the renderer's drawNode.
        fill: paint.fill,
        stroke: paint.stroke,
        detail: phase.detail,
      },
    }
  })
  const phaseEdges: GraphEdge[] = recording.phases.slice(1).map((phase, index) => ({
    id: `edge:${recording.phases[index]?.id}-${phase.id}`,
    from: `phase:${recording.phases[index]?.id}`,
    to: `phase:${phase.id}`,
    kind: 'flow',
    style: { strokeDash: [6, 4], alpha: 0.35 },
  }))

  // Layer portals live on the ROOT: subnetworks drill exactly one level, so
  // the per-layer plugin detail must be reachable without an intermediate
  // network. Portals grid below the phase flow; hue per layer. A synthetic
  // unattributed portal follows the real layers when runtime-created entries
  // (the include carrier, dynamic mounts) exist outside every patch layer.
  const realRowIds = new Set(recording.layers.flatMap(layer => layer.rowIds))
  const hasUnattributed = constructions.some(event => !realRowIds.has(event.entryId))
    || recording.inactiveEntryIds.some(id => !realRowIds.has(id))
  const placedCount = (rowIds: Set<string>): number =>
    constructions.filter(event => rowIds.has(event.entryId)).length
      + recording.inactiveEntryIds.filter(id => rowIds.has(id)).length
  // A layer earns a portal only when at least one placed plugin attributes to
  // it — an empty portal drills into a blank canvas. Zero-row layers still
  // appear in the composition view.
  const visibleLayers: Array<{ name: string; rowIds: Set<string> ; unattributed: boolean }> = recording.layers
    .map(layer => ({ name: layer.name, rowIds: new Set(layer.rowIds), unattributed: false }))
    .filter(layer => placedCount(layer.rowIds) > 0)
  if (hasUnattributed) {
    visibleLayers.push({ name: UNATTRIBUTED_LAYER, rowIds: realRowIds, unattributed: true })
  }

  const layerNetworkId = (index: number): string => `${LAYER_NETWORK_PREFIX}${index}`
  const portalNodes: GraphNode[] = visibleLayers.map((layer, index) => {
    const hue = LANE_COLORS[index % LANE_COLORS.length] ?? '#4e79a7'
    return {
      id: `portal:layer:${index}`,
      type: 'layer',
      label: layer.name,
      label2: `${layer.rowIds.size} rows`,
      tooltip: `Double-click to enter — ${layer.rowIds.size} composed rows`,
      icon: 'router',
      x: 120 + (index % PORTAL_COLUMNS) * 300,
      y: 320 + Math.floor(index / PORTAL_COLUMNS) * 160,
      networkId: layerNetworkId(index),
      data: { layer: layer.name, fill: hue, stroke: hue },
    }
  })
  const portalEdges: GraphEdge[] = portalNodes.map(portal => ({
    id: `edge:mount-${portal.id}`,
    from: 'phase:mount',
    to: portal.id,
    kind: 'flow',
    style: { strokeDash: [6, 4], alpha: 0.35 },
  }))

  const networks: Record<string, GraphDocument> = {
    [COMPOSE_NETWORK_ID]: buildComposeNetwork(recording),
  }
  visibleLayers.forEach((layer, index) => {
    networks[layerNetworkId(index)] = buildLayerNetwork(recording, layer, constructions)
  })

  return {
    version: 1,
    meta: {
      title: `dsh boot: ${recording.profile}`,
      kind: 'topology',
    },
    nodes: [...phaseNodes, ...portalNodes],
    edges: [...phaseEdges, ...portalEdges],
    groups: [],
    networks,
  }
}

/** The composition view: one node per patch layer in application order. */
function buildComposeNetwork(recording: BootRecording): GraphDocument {
  const nodes: GraphNode[] = recording.layers.map((layer, index) => ({
    id: `layer:${index}`,
    type: 'layer',
    label: layer.name,
    label2: `${layer.rowIds.length} rows`,
    tooltip: layer.rowIds.join(', '),
    icon: 'server',
    x: 120,
    y: 100 + index * 140,
    data: { rowIds: layer.rowIds },
  }))
  const edges: GraphEdge[] = recording.layers.slice(1).map((_, index) => ({
    id: `edge:layer-${index}`,
    from: `layer:${index}`,
    to: `layer:${index + 1}`,
    kind: 'flow',
    label: 'then',
    style: { strokeDash: [6, 4], alpha: 0.35 },
  }))
  return { version: 1, meta: { title: 'Patch layers (application order)' }, nodes, edges, groups: [] }
}

/**
 * One layer's activation view: that layer's plugin nodes only, on a per-layer
 * time axis — replacing the former group-band network whose expanded bands
 * held too many nodes to read. The unattributed variant holds every
 * runtime-created entry (ids outside every declared patch layer).
 */
function buildLayerNetwork(
  recording: BootRecording,
  layer: { name: string; rowIds: Set<string>; unattributed: boolean },
  constructions: BootPluginEvent[],
): GraphDocument {
  const inLayer = (entryId: string): boolean =>
    layer.unattributed ? !layer.rowIds.has(entryId) : layer.rowIds.has(entryId)
  const layerConstructions = constructions.filter(event => inLayer(event.entryId))
  const constructedIds = new Set(layerConstructions.map(event => event.entryId))
  const layerInactive = recording.inactiveEntryIds.filter(id => inLayer(id) && !constructedIds.has(id))
  const layerName = layer.name

  const disposalIds = new Set(
    recording.events.filter(event => event.kind === 'disposal').map(event => event.entryId),
  )

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeIdByEntryId = new Map<string, string>()

  const place = (slot: number): { x: number; y: number } => ({
    x: 120 + (slot % PLUGIN_COLUMNS) * 180,
    y: 100 + Math.floor(slot / PLUGIN_COLUMNS) * 100,
  })

  layerConstructions.forEach((event, slot) => {
    const id = `plugin:${event.entryId}`
    nodeIdByEntryId.set(event.entryId, id)
    const { x, y } = place(slot)
    nodes.push({
      id,
      type: 'plugin',
      label: event.entryName,
      label2: event.entryId,
      tooltip: `+${Math.round(event.atMs)}ms`
        + (event.inject.length > 0 ? ` · inject: ${event.inject.join(', ')}` : ''),
      status: disposalIds.has(event.entryId) ? 'cold' : 'running',
      icon: 'node',
      x,
      y,
      data: { atMs: Math.round(event.atMs), layer: layerName, inject: event.inject, fiberUid: event.fiberUid },
    })
  })

  // Composed rows that never activated (disabled or otherwise inactive): still
  // part of the composition's truth, rendered cold after the activated rows.
  for (const [index, entryId] of layerInactive.entries()) {
    const id = `plugin:${entryId}`
    nodeIdByEntryId.set(entryId, id)
    const { x, y } = place(layerConstructions.length + index)
    nodes.push({
      id,
      type: 'plugin',
      label: entryId,
      label2: entryId,
      tooltip: `${layerName} · disabled/inactive — composed but never activated`,
      status: 'cold',
      icon: 'node',
      x,
      y,
      data: { layer: layerName, inactive: true },
    })
  }

  // Parent edges only when both ends live in THIS layer's subnet.
  for (const event of layerConstructions) {
    const parentId = event.parentEntryId === undefined ? undefined : nodeIdByEntryId.get(event.parentEntryId)
    const childId = nodeIdByEntryId.get(event.entryId)
    if (parentId === undefined || childId === undefined || parentId === childId) continue
    edges.push({
      id: `edge:parent-${event.fiberUid}`,
      from: parentId,
      to: childId,
      kind: 'flow',
      style: { strokeDash: [6, 4], alpha: 0.35 },
    })
  }

  return {
    version: 1,
    meta: {
      title: `${layerName} (${layerConstructions.length} activated, ${layerInactive.length} inactive)`,
    },
    nodes,
    edges,
    groups: [],
  }
}

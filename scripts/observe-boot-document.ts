/**
 * Build an AITopo {@link GraphDocument} from a recorded dsh boot.
 *
 * Pure module: no I/O, no cordis imports. The driver (observe-boot.ts) owns
 * recording; this module owns the document vocabulary:
 *
 * - Root canvas: the launcher's boot phases as a flow (compose → prepare →
 *   mount → settle → ready), each node labeled with its duration.
 * - `networks['network:compose']`: one node per patch layer in application
 *   order — the composition view.
 * - `networks['network:mount']`: one node per plugin entry. x encodes the real
 *   activation order; y lanes group by patch layer; a GraphGroup band per
 *   layer; edges are observed fiber parent-child relations. Entries that were
 *   composed but never activated (disabled rows) render `status: 'cold'`.
 * @module scripts/observe-boot-document
 */

import type { GraphDocument, GraphEdge, GraphGroup, GraphNode } from '@neuravoxel/aitopo'

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

const MOUNT_NETWORK_ID = 'network:mount'
const COMPOSE_NETWORK_ID = 'network:compose'
/** Lane for construction events whose entry id maps to no recorded layer. */
const UNATTRIBUTED_LAYER = '(unattributed)'
/** Plugin nodes per row inside a lane; keeps the fit-all view readable. */
const PLUGIN_COLUMNS = 16
/** Band palette: one hue per patch-layer lane; fill appends 8-digit hex alpha. */
const LANE_COLORS = [
  '#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
] as const

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Attributed layer name for one entry id, or the unattributed lane. */
function layerOfEntry(recording: BootRecording, entryId: string): string {
  const layer = recording.layers.find(candidate => candidate.rowIds.includes(entryId))
  return layer?.name ?? UNATTRIBUTED_LAYER
}

/** Phase nodes carry a `networkId` when that phase drills into a sub-network. */
const DRILL_NETWORK_BY_PHASE: Partial<Record<BootPhaseMark['id'], string>> = {
  compose: COMPOSE_NETWORK_ID,
  mount: MOUNT_NETWORK_ID,
}

/**
 * Duration buckets recolor phase nodes as a heat scale. Colors stay dark so
 * the white default icon keeps its contrast; the renderer reads
 * `node.data.fill`/`stroke` as a body-color override (canvas2d drawNode).
 */
const PHASE_DURATION_BUCKETS = [
  { maxMs: 100, bucket: 'fast', color: '#2e7d32' },
  { maxMs: 1_000, bucket: 'moderate', color: '#9a6b00' },
  { maxMs: 5_000, bucket: 'slow', color: '#d84315' },
] as const

function phaseDurationPaint(durationMs: number): { bucket: string; fill: string; stroke: string } {
  const found = PHASE_DURATION_BUCKETS.find(candidate => durationMs < candidate.maxMs)
  const color = found?.color ?? '#b71c1c'
  return { bucket: found?.bucket ?? 'critical', fill: color, stroke: color }
}

/**
 * Build the AITopo document for a boot recording.
 * @param recording - phases, plugin events, and patch-layer attribution.
 * @returns a `version: 1` GraphDocument (phase flow root + two sub-networks).
 */
export function buildBootDocument(recording: BootRecording): GraphDocument {
  const constructions = recording.events.filter(event => event.kind === 'construction')
  const disposalIds = new Set(
    recording.events.filter(event => event.kind === 'disposal').map(event => event.entryId),
  )

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
    style: { strokeDash: [6, 4] },
  }))

  return {
    version: 1,
    meta: {
      title: `dsh boot: ${recording.profile}`,
      kind: 'topology',
    },
    nodes: phaseNodes,
    edges: phaseEdges,
    groups: [],
    networks: {
      [COMPOSE_NETWORK_ID]: buildComposeNetwork(recording),
      [MOUNT_NETWORK_ID]: buildMountNetwork(recording, constructions, disposalIds),
    },
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
    style: { strokeDash: [6, 4] },
  }))
  return { version: 1, meta: { title: 'Patch layers (application order)' }, nodes, edges, groups: [] }
}

/** The activation view: plugin nodes on a time axis, banded by patch layer. */
function buildMountNetwork(
  recording: BootRecording,
  constructions: BootPluginEvent[],
  disposalIds: Set<string>,
): GraphDocument {
  // A layer earns a lane and a band only when at least one placed plugin
  // attributes to it — an empty band would render as a stray degenerate
  // rectangle (the composed stack legitimately contains zero-row layers,
  // e.g. an empty home patch file).
  const placedLayers = (entryIds: readonly string[]): Set<string> =>
    new Set(entryIds.map(id => layerOfEntry(recording, id)))
  const attributed = new Set([
    ...placedLayers(constructions.map(event => event.entryId)),
    ...placedLayers(recording.inactiveEntryIds),
  ])
  const layerNames = recording.layers
    .map(layer => layer.name)
    .filter(name => attributed.has(name))
  if (attributed.has(UNATTRIBUTED_LAYER)) layerNames.push(UNATTRIBUTED_LAYER)

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  // Group bands assemble at the end: GraphGroup.memberIds is readonly, so
  // membership collects in a mutable map while nodes are placed. The bbox
  // per layer gives collapsed bands their geometry (nodes default 50×50).
  const membersByLayer = new Map<string, string[]>()
  const bboxByLayer = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
  const addMember = (layer: string, nodeId: string, x: number, y: number): void => {
    const members = membersByLayer.get(layer) ?? []
    members.push(nodeId)
    membersByLayer.set(layer, members)
    const bbox = bboxByLayer.get(layer)
    bboxByLayer.set(layer, bbox === undefined
      ? { minX: x, minY: y, maxX: x + 50, maxY: y + 50 }
      : {
        minX: Math.min(bbox.minX, x),
        minY: Math.min(bbox.minY, y),
        maxX: Math.max(bbox.maxX, x + 50),
        maxY: Math.max(bbox.maxY, y + 50),
      })
  }
  const groupIdOf = (layer: string): string => `group:${slug(layer)}`
  const nodeIdByEntryId = new Map<string, string>()

  // Layer blocks stack vertically, each sized by its own row count — a fixed
  // lane pitch would make a tall layer's rows overlap the next lane's block.
  const constructionsByLayer = new Map<string, BootPluginEvent[]>()
  for (const event of constructions) {
    const layer = layerOfEntry(recording, event.entryId)
    const events = constructionsByLayer.get(layer) ?? []
    events.push(event)
    constructionsByLayer.set(layer, events)
  }
  const constructedIds = new Set(constructions.map(event => event.entryId))
  const inactiveByLayer = new Map<string, string[]>()
  for (const entryId of recording.inactiveEntryIds) {
    if (constructedIds.has(entryId)) continue
    const layer = layerOfEntry(recording, entryId)
    const ids = inactiveByLayer.get(layer) ?? []
    ids.push(entryId)
    inactiveByLayer.set(layer, ids)
  }
  const ROW_PITCH = 100
  const LANE_GAP = 60
  const laneBaseY = new Map<string, number>()
  let cursorY = 100
  for (const name of layerNames) {
    laneBaseY.set(name, cursorY)
    const count = (constructionsByLayer.get(name)?.length ?? 0) + (inactiveByLayer.get(name)?.length ?? 0)
    cursorY += Math.ceil(Math.max(count, 1) / PLUGIN_COLUMNS) * ROW_PITCH + LANE_GAP
  }

  const placeNode = (layer: string, slot: number): { x: number; y: number } => ({
    x: 120 + (slot % PLUGIN_COLUMNS) * 180,
    y: (laneBaseY.get(layer) ?? cursorY) + Math.floor(slot / PLUGIN_COLUMNS) * ROW_PITCH,
  })

  constructions.forEach((event) => {
    const layer = layerOfEntry(recording, event.entryId)
    const id = `plugin:${event.entryId}`
    const slot = (constructionsByLayer.get(layer) ?? []).indexOf(event)
    const { x, y } = placeNode(layer, slot === -1 ? 0 : slot)
    nodeIdByEntryId.set(event.entryId, id)
    nodes.push({
      id,
      type: 'plugin',
      label: event.entryName,
      label2: event.entryId,
      tooltip: `+${Math.round(event.atMs)}ms · ${layer}`
        + (event.inject.length > 0 ? ` · inject: ${event.inject.join(', ')}` : ''),
      status: disposalIds.has(event.entryId) ? 'cold' : 'running',
      icon: 'node',
      x,
      y,
      // Dual membership encoding: the renderer resolves groupId first and
      // memberIds as the fallback arm; observe writes both.
      groupId: groupIdOf(layer),
      data: { atMs: Math.round(event.atMs), layer, inject: event.inject, fiberUid: event.fiberUid },
    })
    addMember(layer, id, x, y)
  })

  // Composed rows that never activated (disabled or otherwise inactive): still
  // part of the composition's truth, rendered cold after their layer's rows.
  for (const [layer, ids] of inactiveByLayer) {
    const built = constructionsByLayer.get(layer)?.length ?? 0
    for (const [index, entryId] of ids.entries()) {
      const id = `plugin:${entryId}`
      nodeIdByEntryId.set(entryId, id)
      const { x, y } = placeNode(layer, built + index)
      nodes.push({
        id,
        type: 'plugin',
        label: entryId,
        label2: entryId,
        tooltip: `${layer} · disabled/inactive — composed but never activated`,
        status: 'cold',
        icon: 'node',
        x,
        y,
        groupId: groupIdOf(layer),
        data: { layer, inactive: true },
      })
      addMember(layer, id, x, y)
    }
  }

  for (const event of constructions) {
    const parentId = event.parentEntryId === undefined ? undefined : nodeIdByEntryId.get(event.parentEntryId)
    const childId = nodeIdByEntryId.get(event.entryId)
    if (parentId === undefined || childId === undefined || parentId === childId) continue
    edges.push({
      id: `edge:parent-${event.fiberUid}`,
      from: parentId,
      to: childId,
      kind: 'flow',
      label: 'parent',
      style: { strokeDash: [6, 4] },
    })
  }

  // Bands default collapsed (`expanded` omitted): the subnet opens as a
  // per-layer summary of colored boxes; double-click a band to reveal its
  // members. Collapsed geometry must be explicit — it falls back to the
  // engine's 50×50 otherwise — so each band wraps its member bbox + padding.
  const GROUP_PADDING = 16
  const groups: GraphGroup[] = layerNames.map((name, laneIndex) => {
    const bbox = bboxByLayer.get(name)
    const hue = LANE_COLORS[laneIndex % LANE_COLORS.length] ?? '#4e79a7'
    return {
      id: groupIdOf(name),
      label: name,
      memberIds: membersByLayer.get(name) ?? [],
      x: (bbox?.minX ?? 0) - GROUP_PADDING,
      y: (bbox?.minY ?? 0) - GROUP_PADDING,
      w: bbox === undefined ? 50 : bbox.maxX - bbox.minX + 2 * GROUP_PADDING,
      h: bbox === undefined ? 50 : bbox.maxY - bbox.minY + 2 * GROUP_PADDING,
      style: { fill: `${hue}2e`, stroke: hue },
    }
  })

  return {
    version: 1,
    meta: { title: `Plugin activation (${constructions.length} activated, ${recording.inactiveEntryIds.length} inactive)` },
    nodes,
    edges,
    groups,
  }
}

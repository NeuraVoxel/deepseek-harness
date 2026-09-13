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

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-')
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
    return {
      id: `phase:${phase.id}`,
      type: 'phase',
      label: phase.label,
      label2: `${Math.round(phase.endedAtMs - phase.startedAtMs)}ms`,
      tooltip: phase.detail,
      x: 120 + index * 260,
      y: 120,
      // exactOptionalPropertyTypes: absent drill target omits the key entirely.
      ...(drillNetworkId === undefined ? {} : { networkId: drillNetworkId }),
      data: { phase: phase.id, durationMs: Math.round(phase.endedAtMs - phase.startedAtMs), detail: phase.detail },
    }
  })
  const phaseEdges: GraphEdge[] = recording.phases.slice(1).map((phase, index) => ({
    id: `edge:${recording.phases[index]?.id}-${phase.id}`,
    from: `phase:${recording.phases[index]?.id}`,
    to: `phase:${phase.id}`,
    kind: 'flow',
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
  }))
  return { version: 1, meta: { title: 'Patch layers (application order)' }, nodes, edges, groups: [] }
}

/** The activation view: plugin nodes on a time axis, banded by patch layer. */
function buildMountNetwork(
  recording: BootRecording,
  constructions: BootPluginEvent[],
  disposalIds: Set<string>,
): GraphDocument {
  const layerNames = [...recording.layers.map(layer => layer.name)]
  if (constructions.some(event => layerOfEntry(recording, event.entryId) === UNATTRIBUTED_LAYER)
    || recording.inactiveEntryIds.some(id => layerOfEntry(recording, id) === UNATTRIBUTED_LAYER)) {
    layerNames.push(UNATTRIBUTED_LAYER)
  }
  const laneOf = new Map(layerNames.map((name, index) => [name, index]))

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  // Group bands assemble at the end: GraphGroup.memberIds is readonly, so
  // membership collects in a mutable map while nodes are placed.
  const membersByLayer = new Map<string, string[]>()
  const addMember = (layer: string, nodeId: string): void => {
    const members = membersByLayer.get(layer) ?? []
    members.push(nodeId)
    membersByLayer.set(layer, members)
  }
  const nodeIdByEntryId = new Map<string, string>()

  constructions.forEach((event, index) => {
    const layer = layerOfEntry(recording, event.entryId)
    const id = `plugin:${event.entryId}`
    nodeIdByEntryId.set(event.entryId, id)
    const lane = laneOf.get(layer) ?? layerNames.length
    nodes.push({
      id,
      type: 'plugin',
      label: event.entryName,
      label2: event.entryId,
      tooltip: `+${Math.round(event.atMs)}ms · ${layer}`
        + (event.inject.length > 0 ? ` · inject: ${event.inject.join(', ')}` : ''),
      status: disposalIds.has(event.entryId) ? 'cold' : 'running',
      x: 120 + index * 180,
      y: 100 + lane * 150,
      data: { atMs: Math.round(event.atMs), layer, inject: event.inject, fiberUid: event.fiberUid },
    })
    addMember(layer, id)
  })

  // Composed rows that never activated (disabled or otherwise inactive): still
  // part of the composition's truth, rendered cold at the end of their lane.
  const constructedIds = new Set(constructions.map(event => event.entryId))
  const inactiveNodes = recording.inactiveEntryIds.filter(id => !constructedIds.has(id))
  const laneWidth = 120 + Math.max(constructions.length, 1) * 180
  for (const [index, entryId] of inactiveNodes.entries()) {
    const layer = layerOfEntry(recording, entryId)
    const id = `plugin:${entryId}`
    nodeIdByEntryId.set(entryId, id)
    const lane = laneOf.get(layer) ?? layerNames.length
    nodes.push({
      id,
      type: 'plugin',
      label: entryId,
      label2: entryId,
      tooltip: `${layer} · disabled/inactive — composed but never activated`,
      status: 'cold',
      x: laneWidth + index * 180,
      y: 100 + lane * 150,
      data: { layer, inactive: true },
    })
    addMember(layer, id)
  }

  for (const event of constructions) {
    const parentId = event.parentEntryId === undefined ? undefined : nodeIdByEntryId.get(event.parentEntryId)
    const childId = nodeIdByEntryId.get(event.entryId)
    if (parentId === undefined || childId === undefined || parentId === childId) continue
    edges.push({ id: `edge:parent-${event.fiberUid}`, from: parentId, to: childId, kind: 'flow', label: 'parent' })
  }

  const groups: GraphGroup[] = layerNames.map(name => ({
    id: `group:${slug(name)}`,
    label: name,
    memberIds: membersByLayer.get(name) ?? [],
    expanded: true,
    style: { autoFit: false },
  }))

  return {
    version: 1,
    meta: { title: `Plugin activation (${constructions.length} activated, ${inactiveNodes.length} inactive)` },
    nodes,
    edges,
    groups,
  }
}

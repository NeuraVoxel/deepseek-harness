/**
 * Scene apply uses validated GraphPatch; navigation ops are handled by Network.
 */

import { applyPatch as applyDocumentPatch, type GraphPatch } from '../protocol/patch.ts'
import { graphPatchSchema } from '../protocol/schema.ts'
import { parseDocument } from '../protocol/parse.ts'
import type {
  Alarm,
  GraphDocument,
  GraphEdge,
  GraphGroup,
  GraphNode,
  GraphViewport,
} from '../protocol/types.ts'

/** Snapshot of scene dirty tracking. */
export interface DirtyState {
  readonly invalidateAll: boolean
  readonly ids: ReadonlySet<string>
}

/**
 * In-memory scene driven exclusively by load / apply / layout / subnetwork navigation.
 */
export class GraphScene {
  private rootDocument: GraphDocument = emptyDocument()
  private active: GraphDocument = emptyDocument()
  private readonly nodeMap = new Map<string, GraphNode>()
  private readonly edgeMap = new Map<string, GraphEdge>()
  private readonly groupMap = new Map<string, GraphGroup>()
  private readonly outEdges = new Map<string, string[]>()
  private readonly inEdges = new Map<string, string[]>()
  private sceneVersion = 0
  private invalidateAll = true
  private readonly dirtyIds = new Set<string>()
  /** null = root; otherwise entered child network id (single level). */
  private activeNetworkId: string | null = null
  private selection = new Set<string>()
  private hoverId: string | undefined
  private viewport: GraphViewport = { x: 0, y: 0, zoom: 1 }

  /** Monotonic version bumped on durable scene commits. */
  get version(): number {
    return this.sceneVersion
  }

  /** Active SubNetwork id, or null at root. */
  get currentNetworkId(): string | null {
    return this.activeNetworkId
  }

  /** Stack of network ids under root (empty at root; one id when entered). */
  get networkStack(): readonly string[] {
    return this.activeNetworkId === null ? [] : [this.activeNetworkId]
  }

  get nodes(): ReadonlyMap<string, GraphNode> {
    return this.nodeMap
  }

  get edges(): ReadonlyMap<string, GraphEdge> {
    return this.edgeMap
  }

  get groups(): ReadonlyMap<string, GraphGroup> {
    return this.groupMap
  }

  get selectedIds(): ReadonlySet<string> {
    return this.selection
  }

  get hover(): string | undefined {
    return this.hoverId
  }

  get camera(): GraphViewport {
    return this.viewport
  }

  /**
   * Replace the root document and reset SubNetwork to root.
   * @param input - unknown JSON or GraphDocument.
   */
  load(input: unknown): void {
    const doc = parseDocument(input)
    this.rootDocument = structuredClone(doc)
    this.activeNetworkId = null
    this.commitActive(this.rootDocument, true)
    if (doc.viewport !== undefined) {
      this.viewport = { ...doc.viewport }
    }
  }

  /**
   * Apply a document patch atomically to the active network.
   * @param patch - validated GraphPatch (no SubNetwork navigation).
   */
  apply(patch: GraphPatch): void {
    const parsed = graphPatchSchema.parse(patch)
    const before = this.sceneVersion
    const next = applyDocumentPatch(this.active, parsed)
    this.commitActive(next, false)
    if (this.activeNetworkId === null) {
      this.rootDocument = {
        ...structuredClone(next),
        ...(this.rootDocument.networks !== undefined
          ? { networks: this.rootDocument.networks }
          : {}),
      }
    } else {
      const networks = { ...(this.rootDocument.networks ?? {}) }
      networks[this.activeNetworkId] = structuredClone(next)
      this.rootDocument = { ...this.rootDocument, networks }
    }
    if (next.viewport !== undefined) {
      this.viewport = { ...next.viewport }
    }
    if (this.sceneVersion === before) {
      this.sceneVersion += 1
    }
  }

  /** Project the active network as a GraphDocument. */
  toJSON(): GraphDocument {
    const nodes = [...this.nodeMap.values()]
    const edges = [...this.edgeMap.values()]
    const groups = [...this.groupMap.values()]
    const base: GraphDocument = {
      version: 1,
      nodes,
      edges,
      viewport: this.viewport,
      ...(groups.length > 0 ? { groups } : {}),
    }
    if (this.activeNetworkId === null) {
      return {
        ...base,
        ...(this.rootDocument.meta !== undefined ? { meta: this.rootDocument.meta } : {}),
        ...(this.rootDocument.networks !== undefined ? { networks: this.rootDocument.networks } : {}),
      }
    }
    return {
      ...base,
      ...(this.active.meta !== undefined ? { meta: this.active.meta } : {}),
    }
  }

  /**
   * Enter a child network from the root document.
   * @param id - key in `rootDocument.networks`.
   */
  enterSubNetwork(id: string): void {
    if (this.activeNetworkId !== null) {
      throw new Error('enterSubNetwork: only one level is supported')
    }
    const child = this.rootDocument.networks?.[id]
    if (child === undefined) {
      throw new Error(`enterSubNetwork: missing network ${id}`)
    }
    this.activeNetworkId = id
    this.commitActive(structuredClone(child), true)
  }

  /** Return to the root network. */
  exitSubNetwork(): void {
    if (this.activeNetworkId === null) {
      throw new Error('exitSubNetwork: already at root')
    }
    this.activeNetworkId = null
    this.commitActive(structuredClone(this.rootDocument), true)
  }

  /**
   * Replace node coordinates (layout write path).
   * @param positions - id → x/y.
   */
  writePositions(positions: Readonly<Record<string, { x: number; y: number }>>): void {
    for (const [id, pos] of Object.entries(positions)) {
      const node = this.nodeMap.get(id)
      if (node === undefined) continue
      this.nodeMap.set(id, { ...node, x: pos.x, y: pos.y })
      this.markDirty(id)
    }
    this.sceneVersion += 1
    this.active = {
      version: 1,
      nodes: [...this.nodeMap.values()],
      edges: [...this.edgeMap.values()],
      ...(this.groupMap.size > 0 ? { groups: [...this.groupMap.values()] } : {}),
      viewport: this.viewport,
    }
  }

  setSelection(ids: readonly string[]): void {
    this.selection = new Set(ids)
  }

  setHover(id: string | undefined): void {
    this.hoverId = id
  }

  setCamera(viewport: GraphViewport): void {
    this.viewport = { ...viewport }
    this.invalidateAll = true
  }

  /**
   * Mark element ids dirty for the next paint.
   * @param id - element id.
   */
  markDirty(id: string): void {
    this.dirtyIds.add(id)
  }

  /** Force a full-frame invalidate (camera / resize). */
  markInvalidateAll(): void {
    this.invalidateAll = true
  }

  /** Snapshot and clear dirty state for the paint loop. */
  takeDirty(): DirtyState {
    const state: DirtyState = {
      invalidateAll: this.invalidateAll,
      ids: new Set(this.dirtyIds),
    }
    this.invalidateAll = false
    this.dirtyIds.clear()
    return state
  }

  /**
   * Alarms for a node or edge.
   * @param id - element id.
   */
  alarmsOf(id: string): readonly Alarm[] {
    return this.nodeMap.get(id)?.alarms ?? this.edgeMap.get(id)?.alarms ?? []
  }

  private commitActive(doc: GraphDocument, full: boolean): void {
    this.active = doc
    this.nodeMap.clear()
    this.edgeMap.clear()
    this.groupMap.clear()
    this.outEdges.clear()
    this.inEdges.clear()
    for (const node of doc.nodes) {
      this.nodeMap.set(node.id, node)
      if (!full) this.dirtyIds.add(node.id)
    }
    for (const edge of doc.edges) {
      this.edgeMap.set(edge.id, edge)
      pushIndex(this.outEdges, edge.from, edge.id)
      pushIndex(this.inEdges, edge.to, edge.id)
      if (!full) this.dirtyIds.add(edge.id)
    }
    for (const group of doc.groups ?? []) {
      this.groupMap.set(group.id, group)
      if (!full) this.dirtyIds.add(group.id)
    }
    this.sceneVersion += 1
    if (full) {
      this.invalidateAll = true
      this.dirtyIds.clear()
    }
  }
}

function pushIndex(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key)
  if (list === undefined) map.set(key, [value])
  else list.push(value)
}

function emptyDocument(): GraphDocument {
  return { version: 1, nodes: [], edges: [] }
}

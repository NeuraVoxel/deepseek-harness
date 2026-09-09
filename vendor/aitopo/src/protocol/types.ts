/**
 * AITopo protocol types — Document / Patch / Alarm vocabulary shared by hosts and models.
 */

/** Alarm severity shown on nodes or edges. */
export type AlarmLevel = 'info' | 'warn' | 'error'

/** One alarm attached to a graph element. */
export interface Alarm {
  readonly id: string
  readonly level: AlarmLevel
  readonly message: string
  readonly ts?: string
}

/** Optional document metadata. */
export interface GraphMeta {
  readonly title?: string
  readonly kind?: 'topology' | 'flow' | 'custom'
  readonly [key: string]: unknown
}

/** Viewport camera snapshot when persisted in the document. */
export interface GraphViewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

/** One node in a graph document. */
export interface GraphNode {
  readonly id: string
  readonly type: string
  readonly label: string
  readonly status?: string
  readonly x?: number
  readonly y?: number
  readonly w?: number
  readonly h?: number
  readonly parentId?: string
  readonly groupId?: string
  /** Child SubNetwork id keyed in `document.networks`. */
  readonly networkId?: string
  /** When true, move and membership edits skip this node. */
  readonly locked?: boolean
  readonly alarms?: readonly Alarm[]
  readonly data?: Readonly<Record<string, unknown>>
}

/** Directed edge between two node ids. */
export interface GraphEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind?: string
  readonly alarms?: readonly Alarm[]
  readonly data?: Readonly<Record<string, unknown>>
}

/** Optional paint overrides for a group band outline/fill. */
export interface GraphGroupStyle {
  readonly stroke?: string
  readonly strokeWidth?: number
  /** Canvas setLineDash segments in world px. */
  readonly strokeDash?: readonly number[]
  readonly fill?: string
}

/** Visual grouping band for member nodes. */
export interface GraphGroup {
  readonly id: string
  readonly label: string
  readonly memberIds: readonly string[]
  readonly x?: number
  readonly y?: number
  readonly w?: number
  readonly h?: number
  readonly style?: GraphGroupStyle
}

/**
 * Full graph document (AI / plugin contract).
 * Nested `networks` hold SubNetwork child documents.
 */
export interface GraphDocument {
  readonly version: 1
  readonly meta?: GraphMeta
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly groups?: readonly GraphGroup[]
  readonly networks?: Readonly<Record<string, GraphDocument>>
  readonly viewport?: GraphViewport
}

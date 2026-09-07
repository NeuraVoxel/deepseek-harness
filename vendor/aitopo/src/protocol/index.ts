/**
 * Protocol public surface for AITopo.
 */

export type {
  Alarm,
  AlarmLevel,
  GraphDocument,
  GraphEdge,
  GraphGroup,
  GraphMeta,
  GraphNode,
  GraphViewport,
} from './types.ts'

export type {
  AlarmChangedEvent,
  DocumentChangedEvent,
  GraphEvent,
  HoverChangedEvent,
  LayoutCompletedEvent,
  NodeActivatedEvent,
  SelectionChangedEvent,
  SubNetworkChangedEvent,
  ViewportChangedEvent,
} from './events.ts'

export { parseDocument } from './parse.ts'
export { applyPatch, type GraphPatch, type GraphPatchOp } from './patch.ts'
export { graphDocumentSchema, graphPatchSchema } from './schema.ts'

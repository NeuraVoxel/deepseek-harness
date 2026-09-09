/**
 * @neuravoxel/aitopo — dual-face Canvas topology engine for AI graphs.
 */

export type {
  Alarm,
  AlarmLevel,
  GraphDocument,
  GraphEdge,
  GraphGroup,
  GraphGroupStyle,
  GraphMeta,
  GraphNode,
  GraphViewport,
  GraphEvent,
  GraphPatch,
  GraphPatchOp,
} from './protocol/index.ts'

export {
  parseDocument,
  applyPatch,
  graphDocumentSchema,
  graphPatchSchema,
} from './protocol/index.ts'

export { GraphScene } from './model/index.ts'
export { Network, Viewport, contentBounds, MIN_ZOOM, MAX_ZOOM } from './network/index.ts'
export { Canvas2DRenderer } from './render/index.ts'
export type { Renderer, ViewportState } from './render/index.ts'
export {
  EXTERNAL_DROP_MIME_AITOPO,
  EXTERNAL_DROP_MIME_PLAIN,
  ExternalDropInteraction,
  MoveNodeInteraction,
  PanZoomInteraction,
  SelectActivateInteraction,
  type Interaction,
  type InteractionHost,
} from './interaction/index.ts'
export { layoutGrid, layoutFlowColumns } from './layout/index.ts'
export type { Point, Rect } from './geom.ts'
export { unionRect, hitRect, intersectsRect, growRect } from './geom.ts'

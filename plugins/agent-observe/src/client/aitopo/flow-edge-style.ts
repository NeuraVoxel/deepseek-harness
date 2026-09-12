/**
 * Shared GraphEdgeStyle for Observe flow / architecture edges.
 *
 * AITopo paints from `style` + top-level `label` (not `data.*`). Default
 * `arrowTo` is true in the engine; Observe diagrams stay arrow-free.
 */

import type { GraphEdgeStyle } from '@neuravoxel/aitopo'

export interface FlowEdgeStyleOptions {
  readonly kind?: string
  readonly stroke?: string
  readonly strokeHover?: string
  readonly lineWidth?: number
  readonly strokeDash?: readonly number[]
  readonly alpha?: number
}

/**
 * @param options - kind-driven defaults plus optional overrides.
 * @returns edge style with arrows disabled.
 */
export function flowEdgeStyle(options: FlowEdgeStyleOptions = {}): GraphEdgeStyle {
  const isData = options.kind === 'data'
  return {
    stroke: options.stroke ?? (isData ? '#3a4846' : '#5a6478'),
    strokeHover: options.strokeHover ?? (isData ? '#5eead4' : '#3b82f6'),
    lineWidth: options.lineWidth ?? (isData ? 1.2 : 1.25),
    ...(options.strokeDash === undefined ? {} : { strokeDash: options.strokeDash }),
    ...(options.alpha === undefined ? {} : { alpha: options.alpha }),
    arrowFrom: false,
    arrowTo: false,
  }
}

/**
 * Shared GraphEdgeStyle for Observe flow / architecture edges.
 *
 * AITopo paints from `style` + top-level `label` (not `data.*`). Default
 * `arrowTo` is true in the engine; Observe diagrams stay arrow-free.
 * Edge-label attachments default to black in AITopo — always set light
 * `style.label.color` for the dark Observe canvas.
 */

import type { GraphEdgeStyle, GraphGroup, GraphGroupStyle } from '@neuravoxel/aitopo'

/** Light label on dark canvas (matches node label default). */
export const DARK_CANVAS_LABEL = '#e8eaed'
/** Secondary / muted label on dark canvas. */
export const DARK_CANVAS_LABEL_MUTED = '#c5cad3'

export interface FlowEdgeStyleOptions {
  readonly kind?: string
  readonly stroke?: string
  readonly strokeHover?: string
  readonly lineWidth?: number
  readonly strokeDash?: readonly number[]
  readonly alpha?: number
  /** Override edge mid-label color (defaults to {@link DARK_CANVAS_LABEL}). */
  readonly labelColor?: string
}

/**
 * @param options - kind-driven defaults plus optional overrides.
 * @returns edge style with arrows disabled and light label colors.
 */
export function flowEdgeStyle(options: FlowEdgeStyleOptions = {}): GraphEdgeStyle {
  const isData = options.kind === 'data'
  return {
    stroke: options.stroke ?? (isData ? '#3a4846' : '#5a6478'),
    strokeHover: options.strokeHover ?? (isData ? '#5eead4' : '#3b82f6'),
    lineWidth: options.lineWidth ?? (isData ? 1.2 : 1.25),
    ...(options.strokeDash === undefined ? {} : { strokeDash: options.strokeDash }),
    ...(options.alpha === undefined ? {} : { alpha: options.alpha }),
    label: {
      color: options.labelColor ?? DARK_CANVAS_LABEL,
      fontSize: 11,
    },
    label2: {
      color: DARK_CANVAS_LABEL_MUTED,
      fontSize: 10,
    },
    arrowFrom: false,
    arrowTo: false,
  }
}

/**
 * Vertical world-px clearance above a group for outside `topLeft` labels
 * (AITopo places them above the band; ~fontSize×1.2 + gap, with margin).
 * Prefer an engine `insideTopLeft` when available — until then hosts must space bands.
 */
export const GROUP_OUTSIDE_LABEL_CLEARANCE = 36

/**
 * Group chrome for the dark Observe canvas.
 * LabelAttachment defaults to black `#000000` — set light `label.color` explicitly.
 * `labelPosition: 'topLeft'` is outside the band (engine has no inside corner yet).
 * `label.maxChars: 0` matches AITopo’s group default (never truncate).
 * `autoFit: false` keeps Observe's explicit band geometry.
 */
export const DARK_FLOW_GROUP_STYLE: GraphGroupStyle = {
  stroke: '#9aa3b2',
  strokeWidth: 1,
  fill: 'rgba(148, 163, 184, 0.08)',
  autoFit: false,
  labelPosition: 'topLeft',
  label: {
    color: DARK_CANVAS_LABEL,
    fontSize: 12,
    maxChars: 0,
  },
}

/**
 * Open an Observe layout band. AITopo omits `expanded` → collapsed 50×50 node
 * with members hidden; Fleet / Flow always ship open bands.
 * @param group - group fields without relying on engine expand defaults.
 */
export function observeLayoutGroup(
  group: Omit<GraphGroup, 'expanded' | 'style'> & {
    readonly style?: GraphGroupStyle
  },
): GraphGroup {
  const style = group.style
  const labelPosition = style?.labelPosition ?? DARK_FLOW_GROUP_STYLE.labelPosition
  return {
    ...group,
    expanded: true,
    style: {
      ...DARK_FLOW_GROUP_STYLE,
      ...style,
      autoFit: false,
      ...(labelPosition === undefined ? {} : { labelPosition }),
      label: {
        ...DARK_FLOW_GROUP_STYLE.label,
        ...style?.label,
        maxChars: style?.label?.maxChars ?? 0,
      },
    },
  }
}

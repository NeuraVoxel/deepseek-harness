/**
 * Shared GraphNode.style helpers for Observe’s dark canvas.
 */

import type { GraphNodeStyle } from '@neuravoxel/aitopo'

/** Options for {@link darkFlowNodeStyle}. */
export interface DarkFlowNodeStyleOptions {
  /** When false (default), IconsAttachment is omitted. */
  readonly showIcon?: boolean
  /** Whole-node opacity in `[0, 1]`. */
  readonly alpha?: number
  /** Primary label color. */
  readonly labelColor?: string
  /** Primary label font size in px. */
  readonly labelFontSize?: number
}

/**
 * Dark-canvas node style: centered label; icon gated by `showIcon`.
 * @param options - icon / alpha / label overrides.
 */
export function darkFlowNodeStyle(options: DarkFlowNodeStyleOptions = {}): GraphNodeStyle {
  return {
    labelPosition: 'center',
    showIcon: options.showIcon ?? false,
    ...(options.alpha === undefined ? {} : { alpha: options.alpha }),
    label: {
      color: options.labelColor ?? '#e8eaed',
      fontSize: options.labelFontSize ?? 11,
    },
  }
}

/** Default stage / fleet / process node style (no icon). */
export const DARK_FLOW_NODE_STYLE: GraphNodeStyle = darkFlowNodeStyle()

/** Atlas event bead style (no icon, small white seq). */
export const DARK_EVENT_BEAD_STYLE: GraphNodeStyle = darkFlowNodeStyle({
  showIcon: false,
  labelColor: '#ffffff',
  labelFontSize: 7,
})

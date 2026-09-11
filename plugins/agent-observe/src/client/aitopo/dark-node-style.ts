/**
 * Shared GraphNode.style for Observe’s dark canvas.
 */

import type { GraphNodeStyle } from '@neuravoxel/aitopo'

/** White-ish centered label; icons stay off unless the document sets `icon`. */
export const DARK_FLOW_NODE_STYLE: GraphNodeStyle = {
  labelPosition: 'center',
  label: {
    color: '#e8eaed',
    fontSize: 11,
  },
}

/**
 * Compact centered label for Atlas event beads (seq digits).
 */
export const DARK_EVENT_BEAD_STYLE: GraphNodeStyle = {
  labelPosition: 'center',
  label: {
    color: '#ffffff',
    fontSize: 7,
  },
}

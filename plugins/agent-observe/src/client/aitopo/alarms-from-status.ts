/**
 * Map flow / fleet status values onto AITopo alarms.
 */

import type { Alarm } from '@neuravoxel/aitopo'

/**
 * Build alarm list for a flow node in error (or empty otherwise).
 * @param status - flow node status.
 * @param nodeId - element id used as alarm id prefix.
 * @param detail - optional error detail for the message.
 */
export function alarmsFromStatus(
  status: string | undefined,
  nodeId: string,
  detail?: string,
): Alarm[] | undefined {
  if (status !== 'error') return undefined
  return [{
    id: `alarm:${nodeId}`,
    level: 'error',
    message: detail !== undefined && detail.length > 0 ? detail : 'error',
  }]
}

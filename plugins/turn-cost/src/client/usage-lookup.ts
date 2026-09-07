/**
 * Resolve the Turn-usage fold for one finalized assistant message id.
 */

import type { TurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import type { ChatSnapshot, TurnTailChatData } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { MessageId } from '@deepseek-ai/dsh-llm/brand'

/**
 * Find exact Turn usage for the assistant message that closed a Turn.
 * @param snapshot - current Chat snapshot.
 * @param messageId - durable assistant message id from assistant-actions owner.
 * @returns Turn usage when the closing Turn published it.
 */
export function turnUsageForMessage(
  snapshot: ChatSnapshot,
  messageId: MessageId,
): TurnTokenUsage | undefined {
  for (const key of snapshot.order) {
    const node = snapshot.nodes.get(key)
    if (node === undefined || node.kind !== 'turn-tail') continue
    const data = node.data as TurnTailChatData
    if (data.closing?.finalNode.messageId === messageId) return data.tokenUsage
  }
  return undefined
}

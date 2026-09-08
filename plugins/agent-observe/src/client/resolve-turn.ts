import type { SessionEventWindow } from '@deepseek-ai/dsh-api-session-controller/client'

/**
 * Map a finalized assistant message id to its Session Turn.
 * @param window - Client event window.
 * @param messageId - durable assistant message id from assistant-actions.
 * @returns Turn number, or undefined when no matching assistant/message exists.
 */
export function resolveTurnFromMessageId(
  window: SessionEventWindow,
  messageId: string,
): number | undefined {
  for (const entry of window.entries) {
    if (entry.type !== 'event') continue
    const event = entry.event
    if (event.type !== 'assistant/message') continue
    if (event.data.message.id !== messageId) continue
    return event.data.turn
  }
  return undefined
}

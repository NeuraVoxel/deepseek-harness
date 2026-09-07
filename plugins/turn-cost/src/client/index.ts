/**
 * Turn-cost example plugin — browser half.
 *
 * Registers a per-Turn cost pill on assistant-actions and a session CNY line
 * on the composer dock. Rates come from the Host sessionCost projection view
 * so Client pricing stays aligned with the durable fold.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-session-projection/types'
import type {} from '../types.ts'
import { SessionCostDock } from './SessionCostDock.tsx'
import { TurnCostPanel } from './TurnCostPanel.tsx'
import { en, NS, zh, type TurnCostKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Turn-cost example copy. */
    'turn-cost': TurnCostKey
  }
}

/** Required services for slot registration and dictionaries. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: dictionaries, Turn pill, session dock.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'turn-cost: dictionaries')

  ctx.slots.inject('conversation.chat.assistant-actions', () =>
    ctx.slots.register({
      name: 'conversation.chat.assistant-actions',
      id: 'turn-cost',
      order: 20,
      locale: NS,
    }, TurnCostPanel))

  ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register({
      name: 'conversation.composer.dock',
      id: 'turn-cost',
      order: 10,
      locale: NS,
    }, SessionCostDock))
}

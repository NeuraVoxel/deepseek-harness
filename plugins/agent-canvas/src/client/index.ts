/**
 * Agent Canvas plugin — browser half.
 *
 * Registers a Canvas tab on the conversation view ring (alongside Chat and
 * Trajectory) and derives Host-wide Session/Agent topology from list hooks.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { CanvasView, type CanvasViewInjected } from './CanvasView.tsx'
import { en, NS, zh, type AgentCanvasKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Agent Canvas copy. */
    'agent-canvas': AgentCanvasKey
  }
}

/** Required services for slot registration, session open, and dictionaries. */
export const inject = ['slots', 'locale', 'sessions']

/**
 * Client plugin body: dictionaries + Canvas conversation tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'agent-canvas: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'canvas',
    order: 20,
    locale: NS,
    label: () => t('view.canvas'),
    inject: (_sessionId: SessionId): CanvasViewInjected => ({
      openSession: (id) => { ctx.sessions.open(id) },
    }),
  }, CanvasView))
}

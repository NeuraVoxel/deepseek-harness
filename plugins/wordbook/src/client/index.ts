/**
 * Wordbook browser half: the word entry dock that sits above the composer and
 * dispatches the `/word` command through the existing commands Remote.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { WordbookDock } from './WordbookDock.tsx'

/** Required services for slot registration. */
export const inject = ['slots']

/**
 * Client plugin body: register the wordbook entry dock.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'wordbook',
      order: 20,
    }, WordbookDock))
}

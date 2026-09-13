/**
 * Wordbook browser half: the plugin dictionaries, the two word tool cards, and
 * the word entry dock above the composer.
 * @module dsh-wordbook/src/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { submitWord } from './dock.ts'
import { en, NS, zh, type WordbookKey } from './locales.ts'
import { WordLookupCard } from './WordLookupCard.tsx'
import { WordQueryCard } from './WordQueryCard.tsx'
import { WordbookDock, type WordbookDockInjected } from './WordbookDock.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Wordbook card and dock copy. */
    wordbook: WordbookKey
  }
}

/** Required services for dictionaries, the commands Remote, and slot registration. */
export const inject = ['slots', 'locale', 'remote', 'remote.commands']

/**
 * Client plugin body: register the dictionaries, both tool cards, and the dock.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'wordbook: dictionaries')

  ctx.slots.inject('tool.call.toolview', function* () {
    yield ctx.slots.register(
      { name: 'tool.call.toolview', key: 'word_lookup', locale: NS },
      WordLookupCard,
    )
    yield ctx.slots.register(
      { name: 'tool.call.toolview', key: 'word_query', locale: NS },
      WordQueryCard,
    )
  })

  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'wordbook',
      order: 20,
      locale: NS,
      inject: (sessionId): WordbookDockInjected => ({
        submit: input => submitWord(line => ctx.remote.commands.execute(sessionId, line, []), input),
      }),
    }, WordbookDock))
}

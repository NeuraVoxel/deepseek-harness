/**
 * Wordbook Host half: opens the word store, publishes the `wordbook` service,
 * and registers the `/word` command plus the model-facing word tools.
 * @module dsh-wordbook
 */

import type { Context } from '@deepseek-ai/cordis'
import { registerWordCommand } from './command.ts'
import { Config, type Config as WordbookConfig } from './config.ts'
import { WordbookService } from './service.ts'
import { WordStore } from './store.ts'
import { registerWordTools } from './tools.ts'

/** Cordis plugin name. */
export const name = 'wordbook'

/** Services the Host half requires; the plugin stays pending without them. */
export const inject = ['llm', 'storageDomain', 'commands', 'tools']

export { Config }

/**
 * Mount the wordbook Host half.
 * @param ctx - Host context.
 * @param config - validated plugin configuration.
 * @throws when only one of `provider` and `model` is configured.
 */
export async function apply(ctx: Context, config: WordbookConfig): Promise<void> {
  if ((config.provider === undefined) !== (config.model === undefined)) {
    throw new Error('wordbook: provider and model must be configured together')
  }
  const store = await WordStore.open(ctx)
  ctx.effect(() => () => store.close(), 'wordbook:domain')
  const service = new WordbookService(ctx, store, config)
  registerWordCommand(ctx, service)
  registerWordTools(ctx, service)
}

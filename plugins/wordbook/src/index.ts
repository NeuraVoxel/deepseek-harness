/**
 * Wordbook Host half: the word lookup service, the `/word` command, and the
 * `word_lookup` / `word_query` tools mount here.
 * @module dsh-wordbook
 */

import type { Context } from '@deepseek-ai/cordis'

/** Cordis plugin name. */
export const name = 'wordbook'

/**
 * Mount the wordbook Host half.
 * @param _ctx - Host context.
 */
export function apply(_ctx: Context): void {}

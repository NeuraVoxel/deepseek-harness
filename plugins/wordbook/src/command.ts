/**
 * `/word [--refresh] <word>`: the deterministic, model-free entry that looks a
 * word up and stores it without spending a main-model turn.
 * @module dsh-wordbook/src/command
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type { LookupOutcome, WordbookService } from './service.ts'

/** One parsed `/word` invocation. */
export interface WordCommandRequest {
  /** The word or phrase to look up, with the flag removed. */
  readonly word: string
  /** Whether the invocation asked to ignore a stored record. */
  readonly refresh: boolean
}

/** Text returned for an invocation that names no word. */
export const WORD_COMMAND_USAGE = '用法：/word [--refresh] <单词>'

/**
 * Parse the command's free-form input. The flag is recognized only as a leading
 * token, so a phrase such as `apple --refresh` stays one word.
 * @param rawInput - verbatim text after the command name.
 * @returns the parsed request, or undefined when no word remains.
 */
export function parseWordCommand(rawInput: string): WordCommandRequest | undefined {
  const trimmed = rawInput.trim()
  if (trimmed === '') return undefined
  const refresh = /^--refresh(?:\s|$)/u.test(trimmed)
  const word = refresh ? trimmed.slice('--refresh'.length).trim() : trimmed
  return word === '' ? undefined : { word, refresh }
}

/**
 * Render one lookup outcome as the command card's text.
 * @param outcome - the settled lookup.
 * @returns one line naming the word, its transcription, and its senses.
 */
export function formatLookupOutcome(outcome: LookupOutcome): string {
  const { entry } = outcome
  const transcription = entry.phonetic?.us ?? entry.phonetic?.uk
  const head = transcription === undefined ? entry.display : `${entry.display} ${transcription}`
  const senses = entry.senses
    .map(sense => sense.pos === '' ? sense.meaning : `${sense.pos} ${sense.meaning}`)
    .join('；')
  return outcome.kind === 'existing'
    ? `${head} — ${senses}（已存在，未重新查询）`
    : `${head} — ${senses}（已入库）`
}

/**
 * Register the `/word` command against one wordbook service. Registration is an
 * effect of the calling plugin, so unmounting the plugin removes the command.
 * @param ctx - Host context carrying the command registry.
 * @param service - the wordbook service the command drives.
 */
export function registerWordCommand(ctx: Context, service: WordbookService): void {
  ctx.commands.register({
    name: 'word',
    description: 'Look up a word and store it in the wordbook',
    input: { hint: '<word>' },
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      const request = parseWordCommand(invocation.rawInput)
      if (request === undefined) return { kind: 'error', text: WORD_COMMAND_USAGE }
      try {
        const outcome = await service.lookup(request.word, {
          refresh: request.refresh,
          signal: invocation.signal,
          sessionId: invocation.agent.session.id,
        })
        return { kind: 'success', text: formatLookupOutcome(outcome) }
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
      }
    },
  })
}

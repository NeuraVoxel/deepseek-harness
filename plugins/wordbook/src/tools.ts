/**
 * Model-facing word tools: `word_lookup` stores one looked-up word, and
 * `word_query` reads the stored ones back.
 * @module dsh-wordbook/src/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { WordbookService } from './service.ts'
import type { WordRecord } from './spec.ts'

/**
 * The canonical JSON value both tools expose for one stored word. It mirrors
 * the output schema exactly: optional keys are absent rather than explicitly
 * undefined, so the value the registry validates is the value cards replay.
 */
export interface WordValue {
  /** Normalized storage key. */
  word: string
  /** The form the user typed. */
  display: string
  /** Phonetic transcriptions, absent when the model supplied none. */
  phonetic?: { us?: string; uk?: string }
  /** Normalized senses, most common first. */
  senses: { pos: string; meaning: string; examples?: string[] }[]
  /** The route that produced the record. */
  model: { provider: string; model: string }
  /** Creation stamp, epoch milliseconds. */
  createdAt: number
  /** Last update stamp, epoch milliseconds. */
  updatedAt: number
}

/** Canonical value schema of one stored word, shared by both tools. */
const wordValue = {
  type: 'object',
  additionalProperties: false,
  properties: {
    word: { type: 'string', required: true },
    display: { type: 'string', required: true },
    phonetic: {
      type: 'object',
      additionalProperties: false,
      properties: { us: { type: 'string' }, uk: { type: 'string' } },
    },
    senses: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pos: { type: 'string', required: true },
          meaning: { type: 'string', required: true },
          examples: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    model: {
      type: 'object',
      additionalProperties: false,
      properties: {
        provider: { type: 'string', required: true },
        model: { type: 'string', required: true },
      },
      required: true,
    },
    createdAt: { type: 'integer', required: true },
    updatedAt: { type: 'integer', required: true },
  },
} as const

/**
 * Project one stored record into the canonical tool value.
 * @param entry - the stored record.
 * @returns the same fields with no explicitly-undefined optional keys.
 */
export function toWordValue(entry: WordRecord): WordValue {
  return {
    word: entry.word,
    display: entry.display,
    ...entry.phonetic === undefined ? {} : {
      phonetic: {
        ...entry.phonetic.us === undefined ? {} : { us: entry.phonetic.us },
        ...entry.phonetic.uk === undefined ? {} : { uk: entry.phonetic.uk },
      },
    },
    senses: entry.senses.map(sense => ({
      pos: sense.pos,
      meaning: sense.meaning,
      ...sense.examples === undefined ? {} : { examples: [...sense.examples] },
    })),
    model: { provider: entry.model.provider, model: entry.model.model },
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

/**
 * Render one stored word for the model.
 * @param entry - the canonical word value.
 * @param note - optional trailing line explaining the call's outcome.
 * @returns the multi-line dictionary entry.
 */
export function renderWordEntry(entry: WordValue, note?: string): string {
  const transcription = entry.phonetic?.us ?? entry.phonetic?.uk
  const lines = [transcription === undefined ? entry.display : `${entry.display} ${transcription}`]
  for (const sense of entry.senses) {
    lines.push(`- ${sense.pos === '' ? sense.meaning : `${sense.pos} ${sense.meaning}`}`)
    for (const example of sense.examples ?? []) lines.push(`  e.g. ${example}`)
  }
  if (note !== undefined) lines.push(note)
  return lines.join('\n')
}

/**
 * Render one query result for the model.
 * @param result - matching entries plus the pre-cap match total.
 * @returns the header line followed by one entry per listed word.
 */
export function renderQueryResult(
  result: { entries: WordValue[]; total: number },
): string {
  if (result.total === 0) return 'No stored word matched.'
  const noun = result.total === 1 ? 'word' : 'words'
  const shown = result.entries.length === result.total ? '' : ` (showing ${result.entries.length})`
  return [
    `${result.total} stored ${noun} matched${shown}:`,
    ...result.entries.map(entry => renderWordEntry(entry)),
  ].join('\n')
}

/**
 * Register the two model-facing word tools. Registration is an effect of the
 * calling plugin, so unmounting the plugin removes them from the registry.
 * @param ctx - Host context carrying the tool registry.
 * @param service - the wordbook service the tools drive.
 */
export function registerWordTools(ctx: Context, service: WordbookService): void {
  ctx.tools.register(defineTool({
    name: 'word_lookup',
    description:
      'Look a word or phrase up in a dictionary and store the result in the wordbook. '
      + 'A repeat call returns the stored entry without asking the model again unless refresh is true.',
    parameters: {
      word: { type: 'string', required: true, description: 'The word or phrase to look up' },
      refresh: { type: 'boolean', description: 'Ask the model again instead of returning the stored entry' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          created: { type: 'boolean', required: true },
          entry: { ...wordValue, required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: renderWordEntry(
          value.entry,
          value.created ? 'Stored in the wordbook.' : 'Already stored; the model was not asked again.',
        ),
      }],
      presentationMeta: (args, value) => ({
        kind: 'lookup',
        created: value.created,
        refresh: args.refresh ?? false,
        entry: value.entry,
      }),
    },
    async execute(args, exec) {
      const outcome = await service.lookup(args.word, {
        ...args.refresh === undefined ? {} : { refresh: args.refresh },
        signal: exec.signal,
        ...exec.agent === undefined ? {} : { sessionId: exec.agent.session.id },
      })
      return { created: outcome.kind === 'created', entry: toWordValue(outcome.entry) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'word_query',
    description:
      'Search the words already stored in the wordbook by word or meaning substring. '
      + 'With no text, returns the most recently updated entries. `total` counts every match, '
      + 'so it exceeds the entries list when the result was capped.',
    parameters: {
      text: { type: 'string', description: 'Case-insensitive substring matched against the word and every meaning' },
      limit: { type: 'number', description: 'Maximum entries to return' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          entries: { type: 'array', required: true, items: wordValue },
          total: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderQueryResult(value) }],
      presentationMeta: (_args, value) => ({
        kind: 'query',
        entries: value.entries,
        total: value.total,
      }),
    },
    async execute(args) {
      const result = service.query({
        ...args.text === undefined ? {} : { text: args.text },
        ...args.limit === undefined ? {} : { limit: args.limit },
      })
      return { entries: result.entries.map(toWordValue), total: result.total }
    },
  }))
}

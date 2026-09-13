/**
 * Card data derived from one tool call's persisted `meta`. The wire value is
 * `unknown`, so everything here validates it locally and reports `undefined`
 * for input a card cannot render — the caller then falls back to the generic
 * row instead of showing a half-built word.
 * @module dsh-wordbook/src/client/cards
 */

import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-chat/client'

/** One word as a card renders it. */
export interface CardWord {
  /** The form the user typed. */
  display: string
  /** Phonetic transcriptions, absent when the model supplied none. */
  phonetic?: { us?: string; uk?: string }
  /** Senses in the stored order. */
  senses: { pos: string; meaning: string; examples: string[] }[]
  /** The route that produced the record. */
  model: { provider: string; model: string }
}

/** Card data for one `word_lookup` result. */
export interface LookupCardData {
  kind: 'lookup'
  /** Whether this call stored a new record. */
  created: boolean
  /** Whether the call asked the model again. */
  refresh: boolean
  entry: CardWord
}

/** Card data for one `word_query` result. */
export interface QueryCardData {
  kind: 'query'
  /** Match count before the cap. */
  total: number
  entries: CardWord[]
}

/** The card data one tool result carries, discriminated by tool. */
export type WordCardData = LookupCardData | QueryCardData

/** Narrow an unknown value to a plain record. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Read one non-empty string field. */
function stringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Read one string array, dropping non-string items. */
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Read the optional phonetic object, dropping transcriptions that only hold space. */
function phoneticOf(value: unknown): CardWord['phonetic'] {
  const record = asRecord(value)
  if (record === undefined) return undefined
  const us = stringField(record, 'us')?.trim()
  const uk = stringField(record, 'uk')?.trim()
  const kept = {
    ...us === undefined || us === '' ? {} : { us },
    ...uk === undefined || uk === '' ? {} : { uk },
  }
  return Object.keys(kept).length === 0 ? undefined : kept
}

/** Read one word, or undefined when a required field is missing. */
function wordOf(value: unknown): CardWord | undefined {
  const record = asRecord(value)
  if (record === undefined) return undefined
  const display = stringField(record, 'display') ?? stringField(record, 'word')
  if (display === undefined) return undefined
  const rawSenses = record['senses']
  if (!Array.isArray(rawSenses)) return undefined
  const senses: CardWord['senses'] = []
  for (const raw of rawSenses) {
    const sense = asRecord(raw)
    const meaning = sense === undefined ? undefined : stringField(sense, 'meaning')
    if (sense === undefined || meaning === undefined) return undefined
    senses.push({
      pos: stringField(sense, 'pos') ?? '',
      meaning,
      examples: stringArray(sense['examples']),
    })
  }
  const model = asRecord(record['model'])
  const phonetic = phoneticOf(record['phonetic'])
  return {
    display,
    ...phonetic === undefined ? {} : { phonetic },
    senses,
    model: {
      provider: model === undefined ? '' : stringField(model, 'provider') ?? '',
      model: model === undefined ? '' : stringField(model, 'model') ?? '',
    },
  }
}

/**
 * Validate one tool result's metadata into card data.
 * @param meta - the persisted `result.meta` value, of unknown wire shape.
 * @returns the card data, or undefined when it is absent or malformed.
 */
export function parseWordCardMeta(meta: unknown): WordCardData | undefined {
  const record = asRecord(meta)
  if (record === undefined) return undefined
  if (record['kind'] === 'lookup') {
    const entry = wordOf(record['entry'])
    if (entry === undefined) return undefined
    return {
      kind: 'lookup',
      created: record['created'] === true,
      refresh: record['refresh'] === true,
      entry,
    }
  }
  if (record['kind'] === 'query') {
    const rawEntries = record['entries']
    if (!Array.isArray(rawEntries)) return undefined
    const entries: CardWord[] = []
    for (const raw of rawEntries) {
      const entry = wordOf(raw)
      if (entry === undefined) return undefined
      entries.push(entry)
    }
    const total = record['total']
    return { kind: 'query', total: typeof total === 'number' ? total : entries.length, entries }
  }
  return undefined
}

/**
 * Whether one call has settled into a result node.
 * @param block - the running or settled call.
 * @returns whether the block carries a result.
 */
export function isSettledTool(
  block: ToolCallBlock,
): block is Extract<ToolCallBlock, { kind: 'tool-result' }> {
  return 'kind' in block
}

/**
 * The call's raw argument JSON, available in both call forms.
 * @param block - the running or settled call.
 * @returns the raw arguments, or the empty string when the window dropped them.
 */
export function argsTextOf(block: ToolCallBlock): string {
  return 'kind' in block ? block.call?.argsRaw ?? '' : block.argsRaw
}

/**
 * The settled result's text, or the failure account while running or empty.
 * @param block - the running or settled call.
 * @returns the text a fallback row shows under its title.
 */
export function outputTextOf(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  const parts = block.content.map(item => item.type === 'text' ? item.text : JSON.stringify(item))
  if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`)
  return parts.join('\n')
}

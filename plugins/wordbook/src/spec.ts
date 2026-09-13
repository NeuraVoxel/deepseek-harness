/**
 * The wordbook domain declaration: the durable word record schema and the
 * `defineDomain` spec the store opens.
 * @module dsh-wordbook/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

/** One part-of-speech sense of a word. */
export const wordSenseSchema = z.object({
  pos: z.string(),
  meaning: z.string(),
  examples: z.array(z.string()).optional(),
})

/** One sense, inferred from {@link wordSenseSchema}. */
export type WordSense = z.infer<typeof wordSenseSchema>

/**
 * Durable shape of one stored word. `word` is the normalized storage key while
 * `display` keeps the form the user typed; `model` records the route that
 * produced the record so a later reader can tell which model wrote it.
 */
export const wordRecordSchema = z.object({
  word: z.string(),
  display: z.string(),
  phonetic: z.object({ us: z.string().optional(), uk: z.string().optional() }).optional(),
  senses: z.array(wordSenseSchema),
  model: z.object({ provider: z.string(), model: z.string() }),
  createdAt: z.number(),
  updatedAt: z.number(),
})

/** One stored word record, inferred from {@link wordRecordSchema}. */
export type WordRecord = z.infer<typeof wordRecordSchema>

/**
 * The wordbook domain spec: one `words` table keyed by the normalized word.
 * The default `single` layout keeps record keys opaque, so multi-word entries
 * such as `give up` are usable keys without slugging.
 */
export const wordbookDomainSpec = defineDomain({
  name: 'wordbook',
  version: 1,
  tables: { words: domainTable<string, WordRecord>(wordRecordSchema) },
})

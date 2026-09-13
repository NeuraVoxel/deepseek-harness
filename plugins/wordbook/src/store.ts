/**
 * Word persistence: the single reader and writer over the wordbook domain.
 * @module dsh-wordbook/src/store
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import { wordbookDomainSpec, type WordRecord } from './spec.ts'
import type { QueryRequest, QueryResult } from './types.ts'
import { normalizeWord } from './word.ts'

/**
 * Test whether one record carries the needle in its word or any sense meaning.
 * @param record - stored record to inspect.
 * @param needle - already lower-cased search text.
 * @returns whether the record matches.
 */
function matchesText(record: WordRecord, needle: string): boolean {
  if (record.word.includes(needle)) return true
  return record.senses.some(sense => sense.meaning.toLowerCase().includes(needle))
}

/** Open handle over the wordbook `words` table. */
export class WordStore {
  private constructor(
    private readonly domain: Domain<typeof wordbookDomainSpec>,
    private readonly table: KvTable<string, WordRecord>,
  ) {}

  /**
   * Open the wordbook domain over the storage backend the composition mounts.
   * @param ctx - Host context carrying the domain facility.
   * @returns the opened store; the caller owns closing it.
   */
  static async open(ctx: Context): Promise<WordStore> {
    const domain = await ctx.storageDomain.open(wordbookDomainSpec)
    return new WordStore(domain, domain.table('words'))
  }

  /**
   * Read one stored record.
   * @param word - raw word or phrase; normalized before the lookup.
   * @returns the stored record, or undefined when absent.
   */
  get(word: string): WordRecord | undefined {
    return this.table.get(normalizeWord(word))
  }

  /**
   * Insert or replace one record under its normalized key, stamping the same
   * normalized form into `record.word` so key and record never diverge.
   * @param record - the record to persist; its `word` carries the key.
   * @throws when the normalized key is empty.
   */
  async put(record: WordRecord): Promise<void> {
    const word = normalizeWord(record.word)
    if (word === '') throw new Error('wordbook: refusing to store a record with an empty key')
    await this.table.put(word, { ...record, word })
  }

  /**
   * Match stored records by substring, most recently updated first.
   * @param request - optional text filter and result cap.
   * @returns matching entries plus the pre-cap match total.
   */
  query(request: QueryRequest = {}): QueryResult {
    const needle = request.text === undefined ? '' : request.text.trim().toLowerCase()
    const matches = [...this.table.entries()]
      .map(([, record]) => record)
      .filter(record => needle === '' || matchesText(record, needle))
      .sort((left, right) => right.updatedAt - left.updatedAt)
    const { limit } = request
    return {
      entries: limit === undefined ? matches : matches.slice(0, Math.max(0, limit)),
      total: matches.length,
    }
  }

  /** Number of stored records. */
  get size(): number {
    return this.table.size
  }

  /**
   * Release the domain handle. The composition owns this call; the facility
   * also closes a domain left open when it unmounts.
   */
  async close(): Promise<void> {
    await this.domain.close()
  }
}

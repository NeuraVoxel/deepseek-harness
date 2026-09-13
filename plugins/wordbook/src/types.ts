/**
 * Query types shared across the wordbook Host half.
 * @module dsh-wordbook/src/types
 */

import type { WordRecord } from './spec.ts'

/** One query over stored word records. */
export interface QueryRequest {
  /** Case-insensitive substring matched against the word and every sense meaning. */
  readonly text?: string
  /** Maximum returned entries; absent returns every match. */
  readonly limit?: number
}

/** The stored records a {@link QueryRequest} matched. */
export interface QueryResult {
  /** Matching records, most recently updated first, capped by the request's `limit`. */
  readonly entries: WordRecord[]
  /** Total matches before the cap, so a caller can tell truncation from completeness. */
  readonly total: number
}

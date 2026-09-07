/**
 * Wire types for the turn-cost example: sessionCost projection view + rate table.
 */

import type { RateTable } from './rates.ts'

/** Client-visible session cost totals (durable whole-log fold). */
export interface SessionCostProjection {
  /** Sum of priced Turn totals (CNY). */
  readonly totalCny: number
  readonly inputCny: number
  readonly cacheReadCny: number
  readonly cacheWriteCny: number
  readonly outputCny: number
  /** Turns that closed with a priceable single known route. */
  readonly pricedTurns: number
  /**
   * Closed Turns that could not be priced (missing usage, multi-route, or
   * unknown provider/model in the rate table).
   */
  readonly unpricedTurns: number
  /** Rates the Host fold used; the Client Turn pill reuses them. */
  readonly rates: RateTable
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Example plugin: CNY totals derived from exact per-Turn usage. */
    sessionCost: SessionCostProjection
  }
}

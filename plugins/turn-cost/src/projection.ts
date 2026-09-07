/**
 * sessionCost projection: buffers one open Turn's durable events, prices it
 * with {@link priceTurnUsage} at `turn/end`, and publishes whole-log CNY totals.
 */

import { z } from 'zod'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { deriveTurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import { priceTurnUsage, type RateTable, type RouteRates } from './rates.ts'
import type { SessionCostProjection } from './types.ts'

const routeRatesSchema: z.ZodType<RouteRates> = z.object({
  input: z.number().nonnegative(),
  cacheRead: z.number().nonnegative(),
  cacheWrite: z.number().nonnegative(),
  output: z.number().nonnegative(),
}).strict()

const rateTableSchema: z.ZodType<RateTable> = z.record(z.string(), routeRatesSchema)

const totalsSchema = z.object({
  totalCny: z.number().nonnegative(),
  inputCny: z.number().nonnegative(),
  cacheReadCny: z.number().nonnegative(),
  cacheWriteCny: z.number().nonnegative(),
  outputCny: z.number().nonnegative(),
  pricedTurns: z.number().int().nonnegative(),
  unpricedTurns: z.number().int().nonnegative(),
}).strict()

const stateSchema = totalsSchema.extend({
  rates: rateTableSchema,
  /** Open-Turn event buffer (JSON copies of durable SessionEvent rows). */
  buffer: z.array(z.unknown()),
  open: z.boolean(),
}).strict()

type SessionCostState = z.infer<typeof stateSchema>

const viewSchema: z.ZodType<SessionCostProjection> = totalsSchema.extend({
  rates: rateTableSchema,
}).strict()

/** Event types {@link deriveTurnTokenUsage} reads; everything else is ignored. */
const BUFFERED = new Set([
  'turn/start',
  'turn/end',
  'step/start',
  'step/end',
  'llm/retry',
  'llm/retry-started',
  'assistant/attempt',
  'assistant/message',
])

function emptyTotals(rates: RateTable): SessionCostState {
  return {
    totalCny: 0,
    inputCny: 0,
    cacheReadCny: 0,
    cacheWriteCny: 0,
    outputCny: 0,
    pricedTurns: 0,
    unpricedTurns: 0,
    rates,
    buffer: [],
    open: false,
  }
}

function settleTurn(state: SessionCostState): SessionCostState {
  const events = state.buffer as SessionEvent[]
  const usage = deriveTurnTokenUsage(events)
  const priced = usage === undefined ? undefined : priceTurnUsage(usage, state.rates)
  const base = {
    ...state,
    buffer: [],
    open: false,
  }
  if (priced === undefined) {
    return { ...base, unpricedTurns: state.unpricedTurns + 1 }
  }
  return {
    ...base,
    totalCny: state.totalCny + priced.totalCny,
    inputCny: state.inputCny + priced.inputCny,
    cacheReadCny: state.cacheReadCny + priced.cacheReadCny,
    cacheWriteCny: state.cacheWriteCny + priced.cacheWriteCny,
    outputCny: state.outputCny + priced.outputCny,
    pricedTurns: state.pricedTurns + 1,
  }
}

/**
 * Build the sessionCost unit for one rate table (captured at plugin load).
 * @param rates - validated Config rates (CNY / 1M).
 * @returns a projection definition ready for `ctx.sessionProjections.register`.
 */
export function createSessionCostProjection(rates: RateTable) {
  return {
    key: 'sessionCost' as const,
    stateVersion: 2,
    stateSchema,
    init: () => emptyTotals(rates),
    apply: (state: SessionCostState, event: SessionEvent): SessionCostState => {
      if (!BUFFERED.has(event.type)) return state

      if (event.type === 'turn/start') {
        const cleared = state.open ? settleTurn(state) : state
        return {
          ...cleared,
          buffer: [event],
          open: true,
        }
      }

      if (!state.open) return state

      const buffer = [...state.buffer, event]
      if (event.type === 'turn/end') {
        return settleTurn({ ...state, buffer })
      }
      return { ...state, buffer }
    },
    wire: {
      viewSchema,
      view: (state: SessionCostState): SessionCostProjection => ({
        totalCny: state.totalCny,
        inputCny: state.inputCny,
        cacheReadCny: state.cacheReadCny,
        cacheWriteCny: state.cacheWriteCny,
        outputCny: state.outputCny,
        pricedTurns: state.pricedTurns,
        unpricedTurns: state.unpricedTurns,
        rates: state.rates,
      }),
    },
  } satisfies ProjectionDefinition<'sessionCost', SessionCostState>
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    sessionCost: SessionCostState
  }
}

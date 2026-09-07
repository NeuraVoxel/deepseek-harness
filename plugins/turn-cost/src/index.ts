/**
 * Turn-cost example plugin — Host half.
 *
 * Registers the `sessionCost` session projection so Web clients can show a
 * durable whole-log CNY total. The browser half ships via exports["./client"].
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-session-projection'
import { createSessionCostProjection } from './projection.ts'
import { DEFAULT_RATES, type RateTable } from './rates.ts'
import type {} from './types.ts'

export type { SessionCostProjection } from './types.ts'
export {
  DEFAULT_RATES, DEMO_USD_TO_CNY, formatCny, priceTurnUsage, routeKey,
  type PricedUsage, type RateTable, type RouteRates,
} from './rates.ts'

/** Cordis plugin name. */
export const name = 'turn-cost'

/** Projection registry required; without it the fiber stays pending. */
export const inject = ['sessionProjections']

/** Deployment rate table (CNY / 1M tokens), keyed by `provider/model`. */
export interface Config {
  rates: RateTable
}

const routeRates = z.object({
  input: z.number().min(0),
  cacheRead: z.number().min(0),
  cacheWrite: z.number().min(0),
  output: z.number().min(0),
})

/** Schemastery config: defaults to the demo DeepSeek table. */
export const Config: z<Config> = z.object({
  rates: z.dict(routeRates).default(DEFAULT_RATES),
})

/**
 * Register the sessionCost projection unit for this Config's rates.
 * @param ctx - Host context with sessionProjections.
 * @param config - validated plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.sessionProjections.register(createSessionCostProjection(config.rates))
}

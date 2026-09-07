/**
 * Pure Turn-usage → CNY pricing for the turn-cost example plugin.
 *
 * Rates are CNY (人民币) per 1M tokens. A Turn prices only when it reports
 * exactly one provider/model route and that key exists in the table; otherwise
 * the caller treats the Turn as unpriced.
 */

import type { TurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'

/** Per-bucket CNY rates for one provider/model route (per 1M tokens). */
export interface RouteRates {
  /** Uncached prompt input (`uncachedInputTokens`). */
  readonly input: number
  /** Cache-hit prompt (`cacheReadTokens`). */
  readonly cacheRead: number
  /** Cache-write prompt (`cacheWriteTokens`). */
  readonly cacheWrite: number
  /** Completion output (`outputTokens`). */
  readonly output: number
}

/** Route key → rates map. Keys are `${provider}/${model}`. */
export type RateTable = Readonly<Record<string, RouteRates>>

/** One priced Turn (or session aggregate of the same buckets). */
export interface PricedUsage {
  readonly routeKey: string
  readonly inputCny: number
  readonly cacheReadCny: number
  readonly cacheWriteCny: number
  readonly outputCny: number
  readonly totalCny: number
}

/**
 * Demo FX used only to project the public USD list into CNY for this example.
 * Replace {@link DEFAULT_RATES} with official 元/百万 figures when you have them.
 */
export const DEMO_USD_TO_CNY = 7.2

function usdListToCny(input: number, cacheRead: number, cacheWrite: number, output: number): RouteRates {
  const n = (usd: number): number => Math.round(usd * DEMO_USD_TO_CNY * 10_000) / 10_000
  return {
    input: n(input),
    cacheRead: n(cacheRead),
    cacheWrite: n(cacheWrite),
    output: n(output),
  }
}

/**
 * Demo DeepSeek rates as CNY / 1M (USD public table × {@link DEMO_USD_TO_CNY}).
 * Both `deepseek` (pi-ai) and `deepseek-official` (llm-deepseek) provider ids
 * are listed; aliases share the Flash table.
 */
export const DEFAULT_RATES: RateTable = {
  'deepseek/deepseek-v4-flash': usdListToCny(0.14, 0.0028, 0.14, 0.28),
  'deepseek/deepseek-v4-pro': usdListToCny(0.435, 0.003625, 0.435, 0.87),
  'deepseek/deepseek-chat': usdListToCny(0.14, 0.0028, 0.14, 0.28),
  'deepseek/deepseek-reasoner': usdListToCny(0.14, 0.0028, 0.14, 0.28),
  'deepseek-official/deepseek-v4-flash': usdListToCny(0.14, 0.0028, 0.14, 0.28),
  'deepseek-official/deepseek-v4-pro': usdListToCny(0.435, 0.003625, 0.435, 0.87),
  'deepseek-official/deepseek-chat': usdListToCny(0.14, 0.0028, 0.14, 0.28),
  'deepseek-official/deepseek-reasoner': usdListToCny(0.14, 0.0028, 0.14, 0.28),
}

function tokensToCny(tokens: number, ratePerMillion: number): number {
  return tokens * ratePerMillion / 1_000_000
}

/**
 * Build the route lookup key used in {@link RateTable}.
 * @param provider - assistant message source provider.
 * @param model - assistant message source model.
 * @returns `${provider}/${model}`.
 */
export function routeKey(provider: string, model: string): string {
  return `${provider}/${model}`
}

/**
 * Price one Turn's exact usage buckets when a single known route owns them.
 * @param usage - Turn-level fold from `deriveTurnTokenUsage`.
 * @param rates - deployment rate table (CNY / 1M).
 * @returns itemized CNY, or `undefined` when the Turn cannot be priced.
 */
export function priceTurnUsage(usage: TurnTokenUsage, rates: RateTable): PricedUsage | undefined {
  if (usage.routes === undefined || usage.routes.length !== 1) return undefined
  const route = usage.routes[0]!
  const key = routeKey(route.provider, route.model)
  const table = rates[key]
  if (table === undefined) return undefined

  const inputCny = tokensToCny(usage.uncachedInputTokens, table.input)
  const cacheReadCny = tokensToCny(usage.cacheReadTokens ?? 0, table.cacheRead)
  const cacheWriteCny = tokensToCny(usage.cacheWriteTokens ?? 0, table.cacheWrite)
  const outputCny = tokensToCny(usage.outputTokens, table.output)
  return {
    routeKey: key,
    inputCny,
    cacheReadCny,
    cacheWriteCny,
    outputCny,
    totalCny: inputCny + cacheReadCny + cacheWriteCny + outputCny,
  }
}

/**
 * Format a CNY amount for the example UI (¥ prefix).
 * @param cny - yuan amount.
 * @returns display string with a `¥` prefix.
 */
export function formatCny(cny: number): string {
  if (!Number.isFinite(cny) || cny < 0) return '¥0'
  if (cny === 0) return '¥0'
  if (cny < 0.01) return `¥${cny.toFixed(4)}`
  if (cny < 1) return `¥${cny.toFixed(4)}`
  return `¥${cny.toFixed(2)}`
}

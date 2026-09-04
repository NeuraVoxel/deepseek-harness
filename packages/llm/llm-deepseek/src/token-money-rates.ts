/**
 * Published DeepSeek API monetary token rates (per million tokens).
 *
 * Source: https://api-docs.deepseek.com/quick_start/pricing/
 * Peak rates are exactly 2× during Mon–Fri 01:00–04:00 and 06:00–10:00 UTC;
 * pass `atMs` to {@link deepSeekTokenMoneyRates} to select the window. USD and
 * CNY columns are published in parallel. DeepSeek does not publish a separate
 * cache-write line; `mapUsage` also omits `cacheWriteTokens`.
 *
 * Browser-safe: Chat reads the parallel table from
 * `@deepseek-ai/dsh-token-meter/client` (same numbers; client purity forbids
 * importing this Host package into ui-chat). Keep both tables aligned.
 *
 * @module dsh-llm-deepseek/token-money-rates
 */

import type { LlmTokenMoneyRates } from '@deepseek-ai/dsh-llm'

/** ISO currency used for DeepSeek list-price estimates. */
export type MoneyCurrency = 'USD' | 'CNY'

/** Options that select currency and peak/off-peak for one attempt. */
export interface DeepSeekTokenMoneyRateOptions {
  /** Billing currency; defaults to USD (international list). */
  readonly currency?: MoneyCurrency
  /**
   * Attempt settlement time (Unix epoch ms). When omitted, off-peak rates are
   * used so the helper never invents a clock.
   */
  readonly atMs?: number
}

/** Off-peak USD list prices for catalogued DeepSeek model ids. */
export const DEEPSEEK_TOKEN_MONEY_RATES_USD: Readonly<Record<string, LlmTokenMoneyRates>> = {
  'deepseek-v4-flash': {
    uncachedInputPerMtok: 0.22,
    cacheReadPerMtok: 0.007,
    outputPerMtok: 0.66,
  },
  'deepseek-v4-pro': {
    uncachedInputPerMtok: 0.66,
    cacheReadPerMtok: 0.022,
    outputPerMtok: 1.98,
  },
  'deepseek-v4-flash-vision-exp': {
    uncachedInputPerMtok: 0.22,
    cacheReadPerMtok: 0.007,
    outputPerMtok: 0.66,
  },
}

/** Off-peak CNY list prices for catalogued DeepSeek model ids. */
export const DEEPSEEK_TOKEN_MONEY_RATES_CNY: Readonly<Record<string, LlmTokenMoneyRates>> = {
  'deepseek-v4-flash': {
    uncachedInputPerMtok: 1.5,
    cacheReadPerMtok: 0.05,
    outputPerMtok: 4.5,
  },
  'deepseek-v4-pro': {
    uncachedInputPerMtok: 4.5,
    cacheReadPerMtok: 0.15,
    outputPerMtok: 13.5,
  },
  'deepseek-v4-flash-vision-exp': {
    uncachedInputPerMtok: 1.5,
    cacheReadPerMtok: 0.05,
    outputPerMtok: 4.5,
  },
}

/**
 * Default off-peak USD table (adapter `tokenMoneyRates` declaration).
 * Prefer {@link deepSeekTokenMoneyRates} when currency or peak selection matter.
 */
export const DEEPSEEK_TOKEN_MONEY_RATES = DEEPSEEK_TOKEN_MONEY_RATES_USD

/**
 * Whether `atMs` falls in DeepSeek's published weekday peak UTC windows.
 * Windows are half-open: `[01:00, 04:00)` and `[06:00, 10:00)` UTC, Mon–Fri.
 * @param atMs - Unix epoch milliseconds.
 * @returns true when peak list prices apply.
 */
export function isDeepSeekPeakUtc(atMs: number): boolean {
  if (!Number.isFinite(atMs)) return false
  const date = new Date(atMs)
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  return (minutes >= 60 && minutes < 240) || (minutes >= 360 && minutes < 600)
}

function scaleRates(rates: LlmTokenMoneyRates, factor: number): LlmTokenMoneyRates {
  return {
    uncachedInputPerMtok: rates.uncachedInputPerMtok * factor,
    outputPerMtok: rates.outputPerMtok * factor,
    ...rates.cacheReadPerMtok === undefined
      ? {}
      : { cacheReadPerMtok: rates.cacheReadPerMtok * factor },
    ...rates.cacheWritePerMtok === undefined
      ? {}
      : { cacheWritePerMtok: rates.cacheWritePerMtok * factor },
    ...rates.reasoningPerMtok === undefined
      ? {}
      : { reasoningPerMtok: rates.reasoningPerMtok * factor },
  }
}

/**
 * Look up published monetary rates for one DeepSeek model id.
 * @param model - exact model id on the wire / request header.
 * @param options - currency and optional attempt time for peak selection.
 * @returns list prices for the selected window, or `undefined` when unpublished.
 */
export function deepSeekTokenMoneyRates(
  model: string,
  options: DeepSeekTokenMoneyRateOptions = {},
): LlmTokenMoneyRates | undefined {
  const currency = options.currency ?? 'USD'
  const table = currency === 'CNY' ? DEEPSEEK_TOKEN_MONEY_RATES_CNY : DEEPSEEK_TOKEN_MONEY_RATES_USD
  const base = table[model]
  if (base === undefined) return undefined
  if (options.atMs === undefined || !isDeepSeekPeakUtc(options.atMs)) return base
  return scaleRates(base, 2)
}

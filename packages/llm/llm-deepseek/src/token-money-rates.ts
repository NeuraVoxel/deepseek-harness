/**
 * Published DeepSeek API monetary token rates (USD per million tokens).
 *
 * Source: https://api-docs.deepseek.com/quick_start/pricing/ (off-peak column).
 * Peak rates are exactly 2× during Mon–Fri 01:00–04:00 and 06:00–10:00 UTC;
 * this table ships the off-peak column as the estimate default so the Turn
 * usage panel does not invent a clock. DeepSeek does not publish a separate
 * cache-write line; `mapUsage` also omits `cacheWriteTokens`.
 *
 * Browser-safe: Chat reads the parallel table from
 * `@deepseek-ai/dsh-token-meter/client` (same numbers; client purity forbids
 * importing this Host package into ui-chat). Keep both tables aligned.
 *
 * @module dsh-llm-deepseek/token-money-rates
 */

import type { LlmTokenMoneyRates } from '@deepseek-ai/dsh-llm'

/**
 * Off-peak list prices for catalogued DeepSeek model ids.
 * Unknown ids deliberately have no entry.
 */
export const DEEPSEEK_TOKEN_MONEY_RATES: Readonly<Record<string, LlmTokenMoneyRates>> = {
  'deepseek-v4-flash': {
    uncachedInputUsdPerMtok: 0.22,
    cacheReadUsdPerMtok: 0.007,
    outputUsdPerMtok: 0.66,
  },
  'deepseek-v4-pro': {
    uncachedInputUsdPerMtok: 0.66,
    cacheReadUsdPerMtok: 0.022,
    outputUsdPerMtok: 1.98,
  },
  'deepseek-v4-flash-vision-exp': {
    uncachedInputUsdPerMtok: 0.22,
    cacheReadUsdPerMtok: 0.007,
    outputUsdPerMtok: 0.66,
  },
}

/**
 * Look up published monetary rates for one DeepSeek model id.
 * @param model - exact model id on the wire / request header.
 * @returns off-peak USD-per-million rates, or `undefined` when unpublished.
 */
export function deepSeekTokenMoneyRates(model: string): LlmTokenMoneyRates | undefined {
  return DEEPSEEK_TOKEN_MONEY_RATES[model]
}

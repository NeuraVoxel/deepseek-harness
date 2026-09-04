/**
 * Published DeepSeek API monetary token rates (USD per million tokens).
 *
 * Browser-reachable copy for Chat Turn-usage estimates. Keep numeric values
 * aligned with `packages/llm/llm-deepseek/src/token-money-rates.ts` (adapter
 * declaration). Source: https://api-docs.deepseek.com/quick_start/pricing/
 * (off-peak column). Peak is 2× Mon–Fri 01:00–04:00 and 06:00–10:00 UTC.
 *
 * @module @deepseek-ai/dsh-token-meter/deepseek-token-money-rates
 */

import type { LlmTokenMoneyRates } from '@deepseek-ai/dsh-llm/types'

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

/**
 * Client-reachable monetary rate lookup for Turn usage estimates (C1).
 * Uses the published DeepSeek USD/CNY tables from token-meter/client (aligned
 * with the DeepSeek adapter declaration), selecting peak rates from attempt
 * settlement time.
 */

import {
  deepSeekTokenMoneyRates,
  deriveTurnMoneyCost,
  isDeepSeekPeakUtc,
  type MoneyCurrency,
  type TurnMoneyCost,
  type TurnTokenMoneyRateLookup,
} from '@deepseek-ai/dsh-token-meter/client'
import type { TurnTokenUsage } from '../contract/chat-nodes.ts'

/** Official DeepSeek provider route key used by the shipped adapter. */
const DEEPSEEK_OFFICIAL = 'deepseek-official'

/**
 * Resolve published rates for one attributed Turn attempt route.
 * Non-DeepSeek or unpublished models omit rates (fail-closed).
 * @param route - provider/model attribution from the Turn attempt.
 * @param context - billing currency and attempt settlement time.
 * @returns published rates for the selected window, or undefined.
 */
export const publishedTokenMoneyRates: TurnTokenMoneyRateLookup = (route, context) => {
  if (route.provider !== DEEPSEEK_OFFICIAL) return undefined
  return deepSeekTokenMoneyRates(route.model, {
    currency: context.currency,
    atMs: context.atMs,
  })
}

/**
 * Estimate cost for one exact Turn usage when rates are available.
 * @param usage - Fold result from `deriveTurnTokenUsage`.
 * @param currency - ISO currency matching the active UI locale.
 * @returns monetary rows, or undefined when money cannot be proven.
 */
export function estimateTurnMoneyCost(
  usage: TurnTokenUsage,
  currency: MoneyCurrency = 'USD',
): TurnMoneyCost | undefined {
  return deriveTurnMoneyCost(usage, publishedTokenMoneyRates, currency)
}

/**
 * Format the numeric portion of an estimated money amount.
 * @param amount - non-negative estimated currency units.
 * @returns digit text such as `0.0019` or `1.23` (symbol is locale-owned).
 */
export function formatMoneyAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0.00'
  if (amount >= 0.01) return amount.toFixed(2)
  const fixed = amount.toFixed(4)
  return fixed.replace(/0+$/, '').replace(/\.$/, '') || '0.00'
}

/**
 * Resolve the billing currency code owned by the active Chat locale dictionary.
 * @param code - value of `message.turnUsage.currencyCode`.
 * @returns CNY or USD; unknown codes fall back to USD.
 */
export function moneyCurrencyFromLocaleCode(code: string): MoneyCurrency {
  return code === 'CNY' ? 'CNY' : 'USD'
}

export { isDeepSeekPeakUtc }
export type { MoneyCurrency, TurnMoneyCost }

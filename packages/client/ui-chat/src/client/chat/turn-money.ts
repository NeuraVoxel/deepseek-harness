/**
 * Client-reachable monetary rate lookup for Turn usage estimates (C1).
 * Uses the published DeepSeek off-peak table from token-meter/client (aligned
 * with the DeepSeek adapter declaration).
 */

import {
  deepSeekTokenMoneyRates,
  deriveTurnMoneyCost,
  type TurnMoneyCost,
  type TurnTokenMoneyRateLookup,
} from '@deepseek-ai/dsh-token-meter/client'
import type { TurnTokenUsage } from '../contract/chat-nodes.ts'

/** Official DeepSeek provider route key used by the shipped adapter. */
const DEEPSEEK_OFFICIAL = 'deepseek-official'

/**
 * Resolve published rates for one attributed Turn attempt route.
 * Non-DeepSeek or unpublished models omit rates (fail-closed).
 */
export const publishedTokenMoneyRates: TurnTokenMoneyRateLookup = (route) => {
  if (route.provider !== DEEPSEEK_OFFICIAL) return undefined
  return deepSeekTokenMoneyRates(route.model)
}

/**
 * Estimate USD for one exact Turn usage when rates are available.
 * @param usage - Fold result from `deriveTurnTokenUsage`.
 * @returns monetary rows, or undefined when money cannot be proven.
 */
export function estimateTurnMoneyCost(usage: TurnTokenUsage): TurnMoneyCost | undefined {
  return deriveTurnMoneyCost(usage, publishedTokenMoneyRates)
}

/**
 * Format the numeric portion of an estimated USD amount.
 * @param usd - non-negative estimated dollars.
 * @returns digit text such as `0.0019` or `1.23` (currency symbol is locale-owned).
 */
export function formatUsdAmount(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '0.00'
  if (usd >= 0.01) return usd.toFixed(2)
  const fixed = usd.toFixed(4)
  return fixed.replace(/0+$/, '').replace(/\.$/, '') || '0.00'
}

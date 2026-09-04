/**
 * Client-safe monetary estimate over exact Turn token accounting.
 *
 * Rates are currency units per million tokens. The helper never invents missing
 * rates or partial bills: any contributing bucket without a matching rate omits
 * money for the whole Turn. Distinct from adapter visual-token
 * `imageRequestPricing`.
 */

import type { LlmTokenMoneyRates } from '@deepseek-ai/dsh-llm/types'
import {
  isDeepSeekPeakUtc,
  type MoneyCurrency,
} from './deepseek-token-money-rates.ts'
import type {
  TurnTokenUsage,
  TurnTokenUsageAttempt,
  TurnTokenUsageRoute,
} from './turn-usage.ts'

/** Alias for adapter-published {@link LlmTokenMoneyRates}. */
export type TurnTokenMoneyRates = LlmTokenMoneyRates

/** Currency units charged per 1_000_000 tokens for one rate dimension. */
export type MoneyPerMillionTokens = number

/** Context for one attempt's rate lookup (currency + settlement time). */
export interface TurnTokenMoneyRateContext {
  readonly currency: MoneyCurrency
  /** Attempt settlement time (Unix epoch ms) for peak/off-peak selection. */
  readonly atMs: number
}

/** Lookup monetary rates for one attributed route; omit when unpublished. */
export type TurnTokenMoneyRateLookup = (
  route: TurnTokenUsageRoute,
  context: TurnTokenMoneyRateContext,
) => TurnTokenMoneyRates | undefined

/** Estimated cost for one completed Turn's exact token buckets. */
export interface TurnMoneyCost {
  readonly currency: MoneyCurrency
  readonly total: number
  readonly uncachedInput: number
  readonly output: number
  readonly cacheRead?: number
  readonly cacheWrite?: number
  /** Present only when at least one attempt billed reasoning separately. */
  readonly reasoning?: number
  /**
   * True when at least one priced attempt's settlement time fell in DeepSeek's
   * published peak UTC windows (lookup is expected to return 2× rates then).
   */
  readonly usedPeak: boolean
}

const TOKENS_PER_MTOK = 1_000_000

function isRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function moneyFor(tokens: number, rate: MoneyPerMillionTokens): number {
  return tokens * rate / TOKENS_PER_MTOK
}

interface AttemptMoney {
  readonly uncachedInput: number
  readonly output: number
  readonly cacheRead?: number
  readonly cacheWrite?: number
  readonly reasoning?: number
}

function priceAttempt(
  attempt: TurnTokenUsageAttempt,
  rates: TurnTokenMoneyRates,
): AttemptMoney | undefined {
  if (!isRate(rates.uncachedInputPerMtok) || !isRate(rates.outputPerMtok)) return undefined

  let output: number
  let reasoning: number | undefined
  if (rates.reasoningPerMtok !== undefined) {
    if (!isRate(rates.reasoningPerMtok) || attempt.reasoningTokens === undefined) return undefined
    const remainder = attempt.outputTokens - attempt.reasoningTokens
    if (remainder < 0) return undefined
    output = moneyFor(remainder, rates.outputPerMtok)
    reasoning = moneyFor(attempt.reasoningTokens, rates.reasoningPerMtok)
  } else {
    output = moneyFor(attempt.outputTokens, rates.outputPerMtok)
  }

  let cacheRead: number | undefined
  if (attempt.cacheReadTokens !== undefined) {
    if (!isRate(rates.cacheReadPerMtok)) return undefined
    cacheRead = moneyFor(attempt.cacheReadTokens, rates.cacheReadPerMtok)
  }

  let cacheWrite: number | undefined
  if (attempt.cacheWriteTokens !== undefined) {
    if (!isRate(rates.cacheWritePerMtok)) return undefined
    cacheWrite = moneyFor(attempt.cacheWriteTokens, rates.cacheWritePerMtok)
  }

  return {
    uncachedInput: moneyFor(attempt.uncachedInputTokens, rates.uncachedInputPerMtok),
    output,
    ...cacheRead === undefined ? {} : { cacheRead },
    ...cacheWrite === undefined ? {} : { cacheWrite },
    ...reasoning === undefined ? {} : { reasoning },
  }
}

/**
 * Estimate monetary cost for one exact {@link TurnTokenUsage}.
 *
 * Requires {@link TurnTokenUsage.attempts} (complete route attribution). Looks
 * up rates per attempt; missing rates or rate dimensions omit the whole cost.
 * @param usage - Exact Turn fold result from {@link deriveTurnTokenUsage}.
 * @param lookup - Rates for each attributed `(provider, model)` route.
 * @param currency - ISO currency matching the rate table the lookup returns.
 * @returns estimated cost rows, or undefined when money cannot be proven.
 */
export function deriveTurnMoneyCost(
  usage: TurnTokenUsage,
  lookup: TurnTokenMoneyRateLookup,
  currency: MoneyCurrency = 'USD',
): TurnMoneyCost | undefined {
  const { attempts } = usage
  if (attempts === undefined || attempts.length === 0) return undefined

  let uncachedInput = 0
  let output = 0
  let cacheRead = 0
  let cacheWrite = 0
  let reasoning = 0
  let sawCacheRead = false
  let sawCacheWrite = false
  let sawReasoning = false
  let usedPeak = false

  for (const attempt of attempts) {
    const context: TurnTokenMoneyRateContext = { currency, atMs: attempt.time }
    const rates = lookup(attempt.route, context)
    if (rates === undefined) return undefined
    const priced = priceAttempt(attempt, rates)
    if (priced === undefined) return undefined
    uncachedInput += priced.uncachedInput
    output += priced.output
    if (priced.cacheRead !== undefined) {
      sawCacheRead = true
      cacheRead += priced.cacheRead
    }
    if (priced.cacheWrite !== undefined) {
      sawCacheWrite = true
      cacheWrite += priced.cacheWrite
    }
    if (priced.reasoning !== undefined) {
      sawReasoning = true
      reasoning += priced.reasoning
    }
    if (isDeepSeekPeakUtc(attempt.time)) usedPeak = true
  }

  const total = uncachedInput
    + output
    + (sawCacheRead ? cacheRead : 0)
    + (sawCacheWrite ? cacheWrite : 0)
    + (sawReasoning ? reasoning : 0)

  return {
    currency,
    total,
    uncachedInput,
    output,
    ...sawCacheRead ? { cacheRead } : {},
    ...sawCacheWrite ? { cacheWrite } : {},
    ...sawReasoning ? { reasoning } : {},
    usedPeak,
  }
}

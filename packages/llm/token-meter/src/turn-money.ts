/**
 * Client-safe monetary estimate over exact Turn token accounting.
 *
 * Rates are USD per million tokens. The helper never invents missing rates or
 * partial bills: any contributing bucket without a matching rate omits money
 * for the whole Turn. Distinct from adapter visual-token `imageRequestPricing`.
 */

import type { LlmTokenMoneyRates } from '@deepseek-ai/dsh-llm/types'
import type {
  TurnTokenUsage,
  TurnTokenUsageAttempt,
  TurnTokenUsageRoute,
} from './turn-usage.ts'

/** Alias for adapter-published {@link LlmTokenMoneyRates}. */
export type TurnTokenMoneyRates = LlmTokenMoneyRates

/** USD charged per 1_000_000 tokens for one rate dimension. */
export type UsdPerMillionTokens = number

/** Lookup monetary rates for one attributed route; omit when unpublished. */
export type TurnTokenMoneyRateLookup = (
  route: TurnTokenUsageRoute,
) => TurnTokenMoneyRates | undefined

/** Estimated USD for one completed Turn's exact token buckets. */
export interface TurnMoneyCost {
  readonly totalUsd: number
  readonly uncachedInputUsd: number
  readonly outputUsd: number
  readonly cacheReadUsd?: number
  readonly cacheWriteUsd?: number
  /** Present only when at least one attempt billed reasoning separately. */
  readonly reasoningUsd?: number
}

const TOKENS_PER_MTOK = 1_000_000

function isRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function usdFor(tokens: number, rate: UsdPerMillionTokens): number {
  return tokens * rate / TOKENS_PER_MTOK
}

interface AttemptMoney {
  readonly uncachedInputUsd: number
  readonly outputUsd: number
  readonly cacheReadUsd?: number
  readonly cacheWriteUsd?: number
  readonly reasoningUsd?: number
}

function priceAttempt(
  attempt: TurnTokenUsageAttempt,
  rates: TurnTokenMoneyRates,
): AttemptMoney | undefined {
  if (!isRate(rates.uncachedInputUsdPerMtok) || !isRate(rates.outputUsdPerMtok)) return undefined

  let outputUsd: number
  let reasoningUsd: number | undefined
  if (rates.reasoningUsdPerMtok !== undefined) {
    if (!isRate(rates.reasoningUsdPerMtok) || attempt.reasoningTokens === undefined) return undefined
    const remainder = attempt.outputTokens - attempt.reasoningTokens
    if (remainder < 0) return undefined
    outputUsd = usdFor(remainder, rates.outputUsdPerMtok)
    reasoningUsd = usdFor(attempt.reasoningTokens, rates.reasoningUsdPerMtok)
  } else {
    outputUsd = usdFor(attempt.outputTokens, rates.outputUsdPerMtok)
  }

  let cacheReadUsd: number | undefined
  if (attempt.cacheReadTokens !== undefined) {
    if (!isRate(rates.cacheReadUsdPerMtok)) return undefined
    cacheReadUsd = usdFor(attempt.cacheReadTokens, rates.cacheReadUsdPerMtok)
  }

  let cacheWriteUsd: number | undefined
  if (attempt.cacheWriteTokens !== undefined) {
    if (!isRate(rates.cacheWriteUsdPerMtok)) return undefined
    cacheWriteUsd = usdFor(attempt.cacheWriteTokens, rates.cacheWriteUsdPerMtok)
  }

  return {
    uncachedInputUsd: usdFor(attempt.uncachedInputTokens, rates.uncachedInputUsdPerMtok),
    outputUsd,
    ...cacheReadUsd === undefined ? {} : { cacheReadUsd },
    ...cacheWriteUsd === undefined ? {} : { cacheWriteUsd },
    ...reasoningUsd === undefined ? {} : { reasoningUsd },
  }
}

/**
 * Estimate USD cost for one exact {@link TurnTokenUsage}.
 *
 * Requires {@link TurnTokenUsage.attempts} (complete route attribution). Looks
 * up rates per attempt; missing rates or rate dimensions omit the whole cost.
 * @param usage - Exact Turn fold result from {@link deriveTurnTokenUsage}.
 * @param lookup - Rates for each attributed `(provider, model)` route.
 * @returns estimated USD rows, or undefined when money cannot be proven.
 */
export function deriveTurnMoneyCost(
  usage: TurnTokenUsage,
  lookup: TurnTokenMoneyRateLookup,
): TurnMoneyCost | undefined {
  const { attempts } = usage
  if (attempts === undefined || attempts.length === 0) return undefined

  let uncachedInputUsd = 0
  let outputUsd = 0
  let cacheReadUsd = 0
  let cacheWriteUsd = 0
  let reasoningUsd = 0
  let sawCacheRead = false
  let sawCacheWrite = false
  let sawReasoning = false

  for (const attempt of attempts) {
    const rates = lookup(attempt.route)
    if (rates === undefined) return undefined
    const priced = priceAttempt(attempt, rates)
    if (priced === undefined) return undefined
    uncachedInputUsd += priced.uncachedInputUsd
    outputUsd += priced.outputUsd
    if (priced.cacheReadUsd !== undefined) {
      sawCacheRead = true
      cacheReadUsd += priced.cacheReadUsd
    }
    if (priced.cacheWriteUsd !== undefined) {
      sawCacheWrite = true
      cacheWriteUsd += priced.cacheWriteUsd
    }
    if (priced.reasoningUsd !== undefined) {
      sawReasoning = true
      reasoningUsd += priced.reasoningUsd
    }
  }

  const totalUsd = uncachedInputUsd
    + outputUsd
    + (sawCacheRead ? cacheReadUsd : 0)
    + (sawCacheWrite ? cacheWriteUsd : 0)
    + (sawReasoning ? reasoningUsd : 0)

  return {
    totalUsd,
    uncachedInputUsd,
    outputUsd,
    ...sawCacheRead ? { cacheReadUsd } : {},
    ...sawCacheWrite ? { cacheWriteUsd } : {},
    ...sawReasoning ? { reasoningUsd } : {},
  }
}

import { describe, expect, it } from 'vitest'
import {
  deriveTurnMoneyCost,
  type TurnTokenMoneyRates,
} from '../src/turn-money.ts'
import type { TurnTokenUsage, TurnTokenUsageAttempt } from '../src/turn-usage.ts'

const deepseekChat = { provider: 'deepseek', model: 'deepseek-chat' } as const
const gpt = { provider: 'openai', model: 'gpt-5' } as const

const deepseekRates: TurnTokenMoneyRates = {
  uncachedInputUsdPerMtok: 0.28,
  outputUsdPerMtok: 0.42,
  cacheReadUsdPerMtok: 0.028,
  cacheWriteUsdPerMtok: 0.14,
}

function attempt(
  route: TurnTokenUsageAttempt['route'],
  overrides: Partial<Omit<TurnTokenUsageAttempt, 'route'>> = {},
): TurnTokenUsageAttempt {
  return {
    route,
    uncachedInputTokens: 1_000_000,
    outputTokens: 1_000_000,
    totalTokens: 2_000_000,
    ...overrides,
  }
}

function usage(attempts: readonly TurnTokenUsageAttempt[]): TurnTokenUsage {
  return {
    uncachedInputTokens: attempts.reduce((sum, row) => sum + row.uncachedInputTokens, 0),
    outputTokens: attempts.reduce((sum, row) => sum + row.outputTokens, 0),
    totalTokens: attempts.reduce((sum, row) => sum + row.totalTokens, 0),
    routes: [...new Map(attempts.map(row => [`${row.route.provider}\0${row.route.model}`, row.route])).values()],
    attempts,
  }
}

describe('deriveTurnMoneyCost', () => {
  it('prices a single attributed attempt under its rates', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat, { cacheReadTokens: 1_000_000, cacheWriteTokens: 0 })]),
      route => route.model === 'deepseek-chat' ? deepseekRates : undefined,
    )).toEqual({
      totalUsd: 0.28 + 0.42 + 0.028 + 0,
      uncachedInputUsd: 0.28,
      outputUsd: 0.42,
      cacheReadUsd: 0.028,
      cacheWriteUsd: 0,
    })
  })

  it('sums multi-route attempts under each route rate', () => {
    const openaiRates: TurnTokenMoneyRates = {
      uncachedInputUsdPerMtok: 1,
      outputUsdPerMtok: 2,
    }
    expect(deriveTurnMoneyCost(
      usage([
        attempt(deepseekChat, {
          uncachedInputTokens: 1_000_000,
          outputTokens: 0,
          totalTokens: 1_000_000,
        }),
        attempt(gpt, {
          uncachedInputTokens: 0,
          outputTokens: 1_000_000,
          totalTokens: 1_000_000,
        }),
      ]),
      (route) => {
        if (route.model === 'deepseek-chat') {
          return { uncachedInputUsdPerMtok: 0.5, outputUsdPerMtok: 0.5 }
        }
        if (route.model === 'gpt-5') return openaiRates
        return undefined
      },
    )).toEqual({
      totalUsd: 0.5 + 2,
      uncachedInputUsd: 0.5,
      outputUsd: 2,
    })
  })

  it('omits money when attempts are absent', () => {
    expect(deriveTurnMoneyCost({
      uncachedInputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
    }, () => deepseekRates)).toBeUndefined()
  })

  it('omits money when any contributing route lacks rates', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat), attempt(gpt)]),
      route => route.model === 'deepseek-chat' ? deepseekRates : undefined,
    )).toBeUndefined()
  })

  it('omits money when a present cache bucket lacks a rate', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat, { cacheReadTokens: 10 })]),
      () => ({
        uncachedInputUsdPerMtok: 1,
        outputUsdPerMtok: 1,
      }),
    )).toBeUndefined()
  })

  it('does not double-charge reasoning unless rates price it separately', () => {
    const withReasoning = usage([attempt(deepseekChat, {
      outputTokens: 100,
      reasoningTokens: 40,
      totalTokens: 1_000_100,
      uncachedInputTokens: 0,
    })])
    expect(deriveTurnMoneyCost(withReasoning, () => ({
      uncachedInputUsdPerMtok: 0,
      outputUsdPerMtok: 1_000_000,
    }))).toEqual({
      totalUsd: 100,
      uncachedInputUsd: 0,
      outputUsd: 100,
    })
    expect(deriveTurnMoneyCost(withReasoning, () => ({
      uncachedInputUsdPerMtok: 0,
      outputUsdPerMtok: 1_000_000,
      reasoningUsdPerMtok: 2_000_000,
    }))).toEqual({
      totalUsd: 60 + 80,
      uncachedInputUsd: 0,
      outputUsd: 60,
      reasoningUsd: 80,
    })
  })

  it('omits money when separate reasoning rates lack attempt reasoning tokens', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat)]),
      () => ({
        uncachedInputUsdPerMtok: 1,
        outputUsdPerMtok: 1,
        reasoningUsdPerMtok: 2,
      }),
    )).toBeUndefined()
  })

  it('rejects non-finite or negative rates', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat)]),
      () => ({
        uncachedInputUsdPerMtok: Number.NaN,
        outputUsdPerMtok: 1,
      }),
    )).toBeUndefined()
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat)]),
      () => ({
        uncachedInputUsdPerMtok: -1,
        outputUsdPerMtok: 1,
      }),
    )).toBeUndefined()
  })
})

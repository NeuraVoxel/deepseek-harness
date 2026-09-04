import { describe, expect, it } from 'vitest'
import {
  deriveTurnMoneyCost,
  type TurnTokenMoneyRates,
} from '../src/turn-money.ts'
import type { TurnTokenUsage, TurnTokenUsageAttempt } from '../src/turn-usage.ts'

/** Wednesday 2026-08-26 09:27 UTC — inside the 06:00–10:00 peak window. */
const PEAK_MS = Date.UTC(2026, 7, 26, 9, 27, 0)
/** Same Wednesday at 12:00 UTC — off-peak. */
const OFF_PEAK_MS = Date.UTC(2026, 7, 26, 12, 0, 0)

const deepseekChat = { provider: 'deepseek', model: 'deepseek-chat' } as const
const gpt = { provider: 'openai', model: 'gpt-5' } as const

const deepseekRates: TurnTokenMoneyRates = {
  uncachedInputPerMtok: 0.28,
  outputPerMtok: 0.42,
  cacheReadPerMtok: 0.028,
  cacheWritePerMtok: 0.14,
}

function attempt(
  route: TurnTokenUsageAttempt['route'],
  overrides: Partial<Omit<TurnTokenUsageAttempt, 'route'>> = {},
): TurnTokenUsageAttempt {
  return {
    route,
    time: OFF_PEAK_MS,
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
      currency: 'USD',
      total: 0.28 + 0.42 + 0.028 + 0,
      uncachedInput: 0.28,
      output: 0.42,
      cacheRead: 0.028,
      cacheWrite: 0,
      usedPeak: false,
    })
  })

  it('marks usedPeak when the attempt settlement time is in a peak UTC window', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat, { time: PEAK_MS })]),
      () => deepseekRates,
    )?.usedPeak).toBe(true)
  })

  it('sums multi-route attempts under each route rate', () => {
    const openaiRates: TurnTokenMoneyRates = {
      uncachedInputPerMtok: 1,
      outputPerMtok: 2,
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
          return { uncachedInputPerMtok: 0.5, outputPerMtok: 0.5 }
        }
        if (route.model === 'gpt-5') return openaiRates
        return undefined
      },
    )).toEqual({
      currency: 'USD',
      total: 0.5 + 2,
      uncachedInput: 0.5,
      output: 2,
      usedPeak: false,
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
        uncachedInputPerMtok: 1,
        outputPerMtok: 1,
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
      uncachedInputPerMtok: 0,
      outputPerMtok: 1_000_000,
    }))).toEqual({
      currency: 'USD',
      total: 100,
      uncachedInput: 0,
      output: 100,
      usedPeak: false,
    })
    expect(deriveTurnMoneyCost(withReasoning, () => ({
      uncachedInputPerMtok: 0,
      outputPerMtok: 1_000_000,
      reasoningPerMtok: 2_000_000,
    }))).toEqual({
      currency: 'USD',
      total: 60 + 80,
      uncachedInput: 0,
      output: 60,
      reasoning: 80,
      usedPeak: false,
    })
  })

  it('omits money when separate reasoning rates lack attempt reasoning tokens', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat)]),
      () => ({
        uncachedInputPerMtok: 1,
        outputPerMtok: 1,
        reasoningPerMtok: 2,
      }),
    )).toBeUndefined()
  })

  it('rejects non-finite or negative rates', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat)]),
      () => ({
        uncachedInputPerMtok: Number.NaN,
        outputPerMtok: 1,
      }),
    )).toBeUndefined()
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat)]),
      () => ({
        uncachedInputPerMtok: -1,
        outputPerMtok: 1,
      }),
    )).toBeUndefined()
  })

  it('records the requested currency on the cost result', () => {
    expect(deriveTurnMoneyCost(
      usage([attempt(deepseekChat)]),
      () => deepseekRates,
      'CNY',
    )?.currency).toBe('CNY')
  })
})

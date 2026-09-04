import { describe, expect, it } from 'vitest'
import {
  DEEPSEEK_TOKEN_MONEY_RATES,
  DEEPSEEK_TOKEN_MONEY_RATES_CNY,
  deepSeekTokenMoneyRates,
  isDeepSeekPeakUtc,
} from '../src/deepseek-token-money-rates.ts'

/** Wednesday 2026-08-26 09:27 UTC — peak. */
const PEAK_MS = Date.UTC(2026, 7, 26, 9, 27, 0)
/** Wednesday 2026-08-26 12:00 UTC — off-peak. */
const OFF_PEAK_MS = Date.UTC(2026, 7, 26, 12, 0, 0)
/** Saturday 2026-08-29 09:27 UTC — weekend, off-peak despite clock. */
const WEEKEND_MS = Date.UTC(2026, 7, 29, 9, 27, 0)

describe('deepSeekTokenMoneyRates', () => {
  it('publishes off-peak USD list prices for catalogued models', () => {
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash')).toEqual({
      uncachedInputPerMtok: 0.22,
      cacheReadPerMtok: 0.007,
      outputPerMtok: 0.66,
    })
    expect(deepSeekTokenMoneyRates('deepseek-v4-pro')).toEqual({
      uncachedInputPerMtok: 0.66,
      cacheReadPerMtok: 0.022,
      outputPerMtok: 1.98,
    })
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash-vision-exp'))
      .toEqual(DEEPSEEK_TOKEN_MONEY_RATES['deepseek-v4-flash'])
  })

  it('publishes off-peak CNY list prices', () => {
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash', { currency: 'CNY' })).toEqual({
      uncachedInputPerMtok: 1.5,
      cacheReadPerMtok: 0.05,
      outputPerMtok: 4.5,
    })
    expect(deepSeekTokenMoneyRates('deepseek-v4-pro', { currency: 'CNY' }))
      .toEqual(DEEPSEEK_TOKEN_MONEY_RATES_CNY['deepseek-v4-pro'])
  })

  it('doubles rates during published peak UTC windows', () => {
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash', { atMs: PEAK_MS })).toEqual({
      uncachedInputPerMtok: 0.44,
      cacheReadPerMtok: 0.014,
      outputPerMtok: 1.32,
    })
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash', { currency: 'CNY', atMs: PEAK_MS })).toEqual({
      uncachedInputPerMtok: 3,
      cacheReadPerMtok: 0.1,
      outputPerMtok: 9,
    })
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash', { atMs: OFF_PEAK_MS }))
      .toEqual(DEEPSEEK_TOKEN_MONEY_RATES['deepseek-v4-flash'])
  })

  it('omits unpublished models', () => {
    expect(deepSeekTokenMoneyRates('deepseek-chat')).toBeUndefined()
    expect(deepSeekTokenMoneyRates('unlisted')).toBeUndefined()
  })
})

describe('isDeepSeekPeakUtc', () => {
  it('matches half-open weekday UTC windows and excludes weekends', () => {
    expect(isDeepSeekPeakUtc(PEAK_MS)).toBe(true)
    expect(isDeepSeekPeakUtc(OFF_PEAK_MS)).toBe(false)
    expect(isDeepSeekPeakUtc(WEEKEND_MS)).toBe(false)
    expect(isDeepSeekPeakUtc(Date.UTC(2026, 7, 26, 1, 0, 0))).toBe(true)
    expect(isDeepSeekPeakUtc(Date.UTC(2026, 7, 26, 4, 0, 0))).toBe(false)
    expect(isDeepSeekPeakUtc(Date.UTC(2026, 7, 26, 6, 0, 0))).toBe(true)
    expect(isDeepSeekPeakUtc(Date.UTC(2026, 7, 26, 10, 0, 0))).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import type { AnonymousUserId } from '@deepseek-ai/dsh-anonymous-user-id'
import { DeepSeekAdapter } from '../src/adapter.ts'
import { resolveAdapterOptions } from '../src/index.ts'
import {
  DEEPSEEK_TOKEN_MONEY_RATES,
  DEEPSEEK_TOKEN_MONEY_RATES_CNY,
  deepSeekTokenMoneyRates,
  isDeepSeekPeakUtc,
} from '../src/token-money-rates.ts'

const TEST_USER_ID = '00000000-0000-4000-8000-000000000001' as AnonymousUserId

/** Wednesday 2026-08-26 09:27 UTC — peak. */
const PEAK_MS = Date.UTC(2026, 7, 26, 9, 27, 0)

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

  it('publishes off-peak CNY list prices and doubles at peak', () => {
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash', { currency: 'CNY' }))
      .toEqual(DEEPSEEK_TOKEN_MONEY_RATES_CNY['deepseek-v4-flash'])
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash', { atMs: PEAK_MS })?.uncachedInputPerMtok)
      .toBe(0.44)
    expect(isDeepSeekPeakUtc(PEAK_MS)).toBe(true)
  })

  it('omits unpublished or legacy model ids', () => {
    expect(deepSeekTokenMoneyRates('deepseek-chat')).toBeUndefined()
    expect(deepSeekTokenMoneyRates('unlisted')).toBeUndefined()
  })
})

describe('DeepSeekAdapter.tokenMoneyRates', () => {
  it('exposes the published off-peak USD table through the adapter method', () => {
    const adapter = new DeepSeekAdapter({
      options: () => resolveAdapterOptions({}),
      resolveApiKey: () => Promise.resolve('k'),
      resolveUserId: () => TEST_USER_ID,
      prepareExtensions: () => Promise.resolve({ fields: {}, accept: () => Promise.resolve() }),
    })
    expect(adapter.tokenMoneyRates('deepseek-official', 'deepseek-v4-flash'))
      .toEqual(deepSeekTokenMoneyRates('deepseek-v4-flash'))
    expect(adapter.tokenMoneyRates('deepseek-official', 'unknown')).toBeUndefined()
  })
})

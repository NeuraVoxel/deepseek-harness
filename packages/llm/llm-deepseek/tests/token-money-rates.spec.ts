import { describe, expect, it } from 'vitest'
import type { AnonymousUserId } from '@deepseek-ai/dsh-anonymous-user-id'
import { DeepSeekAdapter } from '../src/adapter.ts'
import { resolveAdapterOptions } from '../src/index.ts'
import {
  DEEPSEEK_TOKEN_MONEY_RATES,
  deepSeekTokenMoneyRates,
} from '../src/token-money-rates.ts'

const TEST_USER_ID = '00000000-0000-4000-8000-000000000001' as AnonymousUserId

describe('deepSeekTokenMoneyRates', () => {
  it('publishes off-peak list prices for catalogued models', () => {
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash')).toEqual({
      uncachedInputUsdPerMtok: 0.22,
      cacheReadUsdPerMtok: 0.007,
      outputUsdPerMtok: 0.66,
    })
    expect(deepSeekTokenMoneyRates('deepseek-v4-pro')).toEqual({
      uncachedInputUsdPerMtok: 0.66,
      cacheReadUsdPerMtok: 0.022,
      outputUsdPerMtok: 1.98,
    })
    expect(deepSeekTokenMoneyRates('deepseek-v4-flash-vision-exp'))
      .toEqual(DEEPSEEK_TOKEN_MONEY_RATES['deepseek-v4-flash'])
  })

  it('omits unpublished or legacy model ids', () => {
    expect(deepSeekTokenMoneyRates('deepseek-chat')).toBeUndefined()
    expect(deepSeekTokenMoneyRates('unlisted')).toBeUndefined()
  })
})

describe('DeepSeekAdapter.tokenMoneyRates', () => {
  it('exposes the published table through the adapter method', () => {
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

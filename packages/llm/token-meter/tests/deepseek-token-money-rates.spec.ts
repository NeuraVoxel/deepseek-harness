import { describe, expect, it } from 'vitest'
import {
  DEEPSEEK_TOKEN_MONEY_RATES,
  deepSeekTokenMoneyRates,
} from '../src/deepseek-token-money-rates.ts'

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

/**
 * Client-namespace projection of token-meter's browser-safe contracts and folds.
 *
 * @module @deepseek-ai/dsh-token-meter/client
 */

export type * from './projection.ts'
export { deriveTurnTokenUsage } from './turn-usage.ts'
export type {
  TurnTokenUsage,
  TurnTokenUsageAttempt,
  TurnTokenUsageRoute,
} from './turn-usage.ts'
export { deriveTurnMoneyCost } from './turn-money.ts'
export type {
  MoneyPerMillionTokens,
  TurnMoneyCost,
  TurnTokenMoneyRateContext,
  TurnTokenMoneyRateLookup,
  TurnTokenMoneyRates,
} from './turn-money.ts'
export {
  DEEPSEEK_TOKEN_MONEY_RATES,
  DEEPSEEK_TOKEN_MONEY_RATES_CNY,
  DEEPSEEK_TOKEN_MONEY_RATES_USD,
  deepSeekTokenMoneyRates,
  isDeepSeekPeakUtc,
} from './deepseek-token-money-rates.ts'
export type {
  DeepSeekTokenMoneyRateOptions,
  MoneyCurrency,
} from './deepseek-token-money-rates.ts'

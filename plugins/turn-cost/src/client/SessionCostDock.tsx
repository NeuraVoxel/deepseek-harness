/**
 * Composer-dock session cost line: durable whole-log CNY from sessionCost.
 */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { formatCny } from '../rates.ts'
import type { NS } from './locales.ts'
import css from './SessionCostDock.module.css'

/** Full props of the composer-dock session-cost entry. */
export type SessionCostDockProps =
  PropsRuntime<'conversation.composer.dock'>
  & PropsLocale<typeof NS>

/**
 * Compact session spend row under the composer.
 * @param props - composer-dock runtime props plus this plugin's locale seat.
 * @returns the dock line, or null when the projection is absent / idle.
 */
export function SessionCostDock({ useProjection, t }: SessionCostDockProps) {
  const cost = useProjection('sessionCost')
  if (cost === undefined) return null
  if (cost.pricedTurns === 0 && cost.unpricedTurns === 0) return null
  if (cost.pricedTurns === 0 && cost.totalCny === 0) {
    return (
      <div className={css.root}>
        {t('session.line', { total: formatCny(0) })}
        {cost.unpricedTurns > 0 && (
          <span className={css.hint}>
            {t('session.unpriced', { count: String(cost.unpricedTurns) })}
          </span>
        )}
      </div>
    )
  }
  return (
    <div className={css.root} data-session-cost>
      {t('session.line', { total: formatCny(cost.totalCny) })}
      {cost.unpricedTurns > 0 && (
        <span className={css.hint}>
          {t('session.unpriced', { count: String(cost.unpricedTurns) })}
        </span>
      )}
    </div>
  )
}

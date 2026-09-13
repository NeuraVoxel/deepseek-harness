/**
 * `word_query` card: the stored words a query matched, or the generic row while
 * running, on failure, or when the persisted metadata is unusable.
 * @module dsh-wordbook/src/client/WordQueryCard
 */

import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { argsTextOf, isSettledTool, outputTextOf, parseWordCardMeta } from './cards.ts'
import { FallbackRow, Senses } from './CardParts.tsx'
import type { NS } from './locales.ts'
import css from './WordbookCard.module.css'

/** Full props of the `word_query` view. */
export type WordQueryCardProps = ToolCallViewProps & PropsLocale<typeof NS>

/**
 * Render one query result.
 * @param props - the tool view props plus this plugin's locale seat.
 * @returns the word list card, or the generic fallback row.
 */
export function WordQueryCard({ block, t }: WordQueryCardProps) {
  const meta = parseWordCardMeta(isSettledTool(block) ? block.meta : undefined)
  if (meta?.kind !== 'query') {
    const status = !isSettledTool(block)
      ? t('query.running')
      : block.isError ? t('query.failed') : t('query.title')
    return <FallbackRow title={t('query.title')} status={status} detail={outputTextOf(block) || argsTextOf(block)} />
  }
  if (meta.total === 0) {
    return (
      <div className={css.card} data-wordbook="query" data-state="empty">
        <div className={css.empty}>{t('query.empty')}</div>
      </div>
    )
  }
  const capped = meta.entries.length < meta.total
  return (
    <div className={css.card} data-wordbook="query" data-state="matches">
      <div className={css.queryHead}>
        <span>{t('query.matches', { total: String(meta.total) })}</span>
        {capped ? <span>{t('query.showing', { shown: String(meta.entries.length) })}</span> : null}
      </div>
      {meta.entries.map(entry => (
        <div className={css.entry} key={entry.display}>
          <div className={css.head}>
            <span className={css.display}>{entry.display}</span>
            {entry.phonetic?.us === undefined && entry.phonetic?.uk === undefined
              ? null
              : <span className={css.phonetic}>{entry.phonetic?.us ?? entry.phonetic?.uk}</span>}
          </div>
          <Senses senses={entry.senses} />
        </div>
      ))}
    </div>
  )
}

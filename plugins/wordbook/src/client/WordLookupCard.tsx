/**
 * `word_lookup` card: the stored entry, or the generic row while running, on
 * failure, or when the persisted metadata is unusable.
 * @module dsh-wordbook/src/client/WordLookupCard
 */

import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { argsTextOf, isSettledTool, outputTextOf, parseWordCardMeta } from './cards.ts'
import { FallbackRow, Senses } from './CardParts.tsx'
import type { NS } from './locales.ts'
import css from './WordbookCard.module.css'

/** Full props of the `word_lookup` view. */
export type WordLookupCardProps = ToolCallViewProps & PropsLocale<typeof NS>

/**
 * Render one lookup result.
 * @param props - the tool view props plus this plugin's locale seat.
 * @returns the word card, or the generic fallback row.
 */
export function WordLookupCard({ block, t }: WordLookupCardProps) {
  const meta = parseWordCardMeta(isSettledTool(block) ? block.meta : undefined)
  if (meta?.kind !== 'lookup') {
    const status = !isSettledTool(block)
      ? t('lookup.running')
      : block.isError ? t('lookup.failed') : t('lookup.title')
    return <FallbackRow title={t('lookup.title')} status={status} detail={outputTextOf(block) || argsTextOf(block)} />
  }
  const { entry } = meta
  const transcription = entry.phonetic?.us ?? entry.phonetic?.uk
  return (
    <div className={css.card} data-wordbook="lookup" data-state={meta.created ? 'created' : 'existing'}>
      <div className={css.head}>
        <span className={css.display}>{entry.display}</span>
        {transcription === undefined ? null : <span className={css.phonetic}>{transcription}</span>}
        <span className={css.badge}>{meta.created ? t('lookup.created') : t('lookup.existing')}</span>
      </div>
      <Senses senses={entry.senses} />
      <div className={css.meta}>{t('card.model')}: {entry.model.provider}/{entry.model.model}</div>
    </div>
  )
}

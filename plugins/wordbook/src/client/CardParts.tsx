/**
 * Shared parts of the wordbook tool cards: the sense list and the generic
 * fallback row used while a call is running, after a failure, or when the
 * persisted metadata is missing or malformed.
 * @module dsh-wordbook/src/client/CardParts
 */

import type { CardWord } from './cards.ts'
import css from './WordbookCard.module.css'

/** One word's senses and their examples. */
export function Senses({ senses }: { senses: CardWord['senses'] }) {
  if (senses.length === 0) return null
  return (
    <ul className={css.senses}>
      {senses.map((sense, index) => (
        <li className={css.sense} key={`${sense.pos}-${index}`}>
          {sense.pos === '' ? null : <span className={css.pos}>{sense.pos}</span>}
          {sense.meaning}
          {sense.examples.length === 0 ? null : (
            <ul className={css.examples}>
              {sense.examples.map(example => <li key={example}>{example}</li>)}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Generic row for a call this plugin cannot render as a word card. */
export function FallbackRow(
  { title, status, detail }: { title: string; status: string; detail: string },
) {
  return (
    <div className={css.fallback} data-wordbook="fallback">
      <div className={css.fallbackHead}>
        <span>{title}</span>
        <span>{status}</span>
      </div>
      {detail === '' ? null : <pre className={css.detail}>{detail}</pre>}
    </div>
  )
}

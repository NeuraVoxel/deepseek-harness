/**
 * Wordbook entry dock: the row above the composer where a word is typed and
 * dispatched as `/word <word>` through the existing commands Remote. The
 * command card carries the result; this dock only reports a submission that
 * never reached a handler.
 * @module dsh-wordbook/src/client/WordbookDock
 */

import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { DockOutcome } from './dock.ts'
import type { NS } from './locales.ts'
import css from './WordbookCard.module.css'

/** Injected face of the dock entry: the session-bound submission. */
export interface WordbookDockInjected {
  /**
   * Submit one typed word.
   * @param input - the raw input value.
   * @returns what the dock should report.
   */
  submit: (input: string) => Promise<DockOutcome>
}

/** Full props of the dock entry. */
export type WordbookDockProps =
  PropsRuntime<'conversation.input.dock'>
  & InjectFace<WordbookDockInjected>
  & PropsLocale<typeof NS>

/**
 * Render the wordbook entry dock.
 * @param props - input-dock runtime props plus the injected submission and locale seat.
 * @returns the dock form.
 */
export function WordbookDock({ submit, t }: WordbookDockProps) {
  const [value, setValue] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ready = value.trim() !== '' && !busy

  const run = async (): Promise<void> => {
    if (!ready) return
    setBusy(true)
    setFailure(null)
    try {
      const outcome = await submit(value)
      if (outcome.kind === 'failed') setFailure(outcome.message)
      else if (outcome.kind === 'unresolved') setFailure(`unknown command: ${outcome.line}`)
      if (outcome.kind === 'sent') setValue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className={css.dock}
      data-wordbook="dock"
      onSubmit={(event) => {
        event.preventDefault()
        void run()
      }}
    >
      <input
        aria-label={t('dock.placeholder')}
        className={css.input}
        disabled={busy}
        onChange={event => setValue(event.target.value)}
        placeholder={t('dock.placeholder')}
        value={value}
      />
      <button className={css.button} disabled={!ready} type="submit">
        {t('dock.action')}
      </button>
      {failure === null ? null : <span className={css.failure}>{failure}</span>}
    </form>
  )
}

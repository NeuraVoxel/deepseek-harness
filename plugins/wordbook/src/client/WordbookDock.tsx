/**
 * Wordbook entry dock: the row above the composer where a word is typed and
 * dispatched as `/word <word>`.
 */

import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Runtime props of the wordbook entry dock. */
export type WordbookDockProps = PropsRuntime<'conversation.input.dock'>

/**
 * Render the wordbook entry dock.
 * @param _props - input-dock runtime props.
 * @returns the dock element.
 */
export function WordbookDock(_props: WordbookDockProps) {
  return <div data-wordbook-dock />
}

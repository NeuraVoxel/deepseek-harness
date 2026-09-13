/**
 * Pure dock logic: build the `/word` command line and classify what the
 * commands Remote answered, so the component only maps outcomes to copy.
 * @module dsh-wordbook/src/client/dock
 */

import type { RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { CommandExecution } from '@deepseek-ai/dsh-commands'

/** What the dock reports after one submission. */
export type DockOutcome =
  /** The input held no word; nothing was dispatched. */
  | { readonly kind: 'empty' }
  /** The command was accepted; its own card carries the result. */
  | { readonly kind: 'sent' }
  /** The line named no registered command — the Host half is not mounted. */
  | { readonly kind: 'unresolved'; readonly line: string }
  /** The dispatch failed on the wire. */
  | { readonly kind: 'failed'; readonly message: string }

/**
 * Build the command line for one submission.
 * @param input - the raw input value.
 * @returns the `/word` line, or undefined when the input holds no word.
 */
export function wordCommandLine(input: string): string | undefined {
  const word = input.trim()
  return word === '' ? undefined : `/word ${word}`
}

/**
 * Dispatch one submission through the commands Remote.
 * @param submit - the session-bound dispatch, usually `ctx.remote.commands.execute`.
 * @param input - the raw input value.
 * @returns what the dock should report.
 */
export async function submitWord(
  submit: (line: string) => Promise<RemoteResult<CommandExecution | undefined>>,
  input: string,
): Promise<DockOutcome> {
  const line = wordCommandLine(input)
  if (line === undefined) return { kind: 'empty' }
  const result = await submit(line)
  if (!result.ok) return { kind: 'failed', message: `${result.error.message} (${result.error.code})` }
  return result.value === undefined ? { kind: 'unresolved', line } : { kind: 'sent' }
}
